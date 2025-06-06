import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { ScoredPineconeRecord } from "@pinecone-database/pinecone";
import { createAdminClient } from "@lib/supabase/server";
import { Database } from "@supabase/database.types";
import { TextPreprocessingService } from "./text-preprocessing-service";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

// Get or create the index for YouTube questions
const youtubeQuestionsIndex = pinecone.Index("youtube-questions");

// Ensure the index exists
async function ensureIndexExists() {
  try {
    const indexes = await pinecone.listIndexes();

    if (!indexes.indexes?.some((index) => index.name === "youtube-questions")) {
      console.log("Creating youtube-questions index...");

      await pinecone.createIndex({
        name: "youtube-questions",
        dimension: 1536, // OpenAI text-embedding-3-small dimension
        metric: "cosine",
        spec: {
          serverless: {
            cloud: "aws",
            region: "us-east-1",
          },
        },
      });

      console.log("Index created successfully");
    }
  } catch (error) {
    console.error("Error ensuring index exists:", error);
    throw error;
  }
}

// Call this when the service starts
ensureIndexExists().catch(console.error);

type Comment = Database["public"]["Tables"]["comments"]["Row"];
type Question = Database["public"]["Tables"]["questions"]["Insert"];
type QuestionCluster =
  Database["public"]["Tables"]["question_clusters"]["Insert"];
type QuestionMetric =
  Database["public"]["Tables"]["question_metrics"]["Insert"];

export class QuestionClusteringService {
  /**
   * Get embedding for a question using OpenAI
   * @private
   */
  private static async getEmbedding(text: string): Promise<number[]> {
    try {
      const processedText = TextPreprocessingService.preprocessText(text);
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: processedText,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error("Error getting embedding:", error);
      throw error;
    }
  }

  /**
   * Create a new cluster for a question
   * @private
   */
  private static async createCluster(
    channelId: string,
    question: Comment
  ): Promise<string> {
    const supabase = await createAdminClient();
    const cluster: QuestionCluster = {
      channel_id: channelId,
      name: question.content,
    };

    const { data, error } = await supabase
      .from("question_clusters")
      .insert(cluster)
      .select()
      .single();

    if (error) {
      console.error("Error creating cluster:", error);
      throw error;
    }

    return data.id;
  }

  /**
   * Store a canonical question in Supabase and Pinecone
   * @private
   */
  private static async storeCanonicalQuestion(
    question: string,
    clusterId: string,
    channelId: string,
    videoId: string
  ): Promise<string> {
    try {
      const supabase = await createAdminClient();

      // Get embedding for the question
      const embedding = await this.getEmbedding(question);

      // Create a new question in Supabase
      const { data: questionData, error: questionError } = await supabase
        .from("questions")
        .insert({
          canonical_question: question,
          cluster_id: clusterId,
          channel_id: channelId,
          pinecone_id: `q_${Date.now()}`,
        })
        .select()
        .single();

      if (questionError) {
        throw questionError;
      }

      // Store the embedding in Pinecone
      await youtubeQuestionsIndex.upsert([
        {
          id: questionData.pinecone_id,
          values: embedding,
          metadata: {
            question_id: questionData.id,
            canonical_question: question,
            cluster_id: clusterId,
            channel_id: channelId,
            created_at: new Date().toISOString(),
          },
        },
      ]);

      // Create initial metric entry
      const { error: metricError } = await supabase
        .from("question_metrics")
        .insert({
          question_id: questionData.id,
          video_id: videoId,
          channel_id: channelId,
          frequency: 1,
          last_updated: new Date().toISOString(),
        });

      if (metricError) {
        console.error("Error creating initial metric:", metricError);
        throw metricError;
      }

      return questionData.id;
    } catch (error) {
      console.error("Error storing canonical question:", error);
      throw error;
    }
  }

  /**
   * Find similar questions using Pinecone
   */
  static async findSimilarQuestions(
    question: string,
    channelId: string,
    threshold: number = 0.7
  ): Promise<{ questionId: string; clusterId: string; similarity: number }[]> {
    try {
      const embedding = await this.getEmbedding(question);
      const results = await youtubeQuestionsIndex.query({
        vector: embedding,
        topK: 5,
        includeMetadata: true,
        filter: {
          channel_id: channelId,
        },
      });

      return results.matches
        .filter(
          (match: ScoredPineconeRecord) => (match.score || 0) >= threshold
        )
        .map((match: ScoredPineconeRecord) => ({
          questionId: match.metadata?.question_id as string,
          clusterId: match.metadata?.cluster_id as string,
          similarity: match.score || 0,
        }));
    } catch (error) {
      console.error("Error finding similar questions:", error);
      throw error;
    }
  }

  /**
   * Process a batch of questions for clustering
   * @private
   */
  private static async processQuestionsBatch(
    comments: Comment[]
  ): Promise<void> {
    try {
      const supabase = await createAdminClient();

      // Filter for comments that are questions with high confidence
      const questions = comments.filter(
        (comment) =>
          comment.is_question && (comment.question_confidence || 0) > 0.6
      );
      for (const question of questions) {
        // Find similar questions
        const similarQuestions = await this.findSimilarQuestions(
          question.content,
          question.channel_id
        );
        if (similarQuestions.length > 0) {
          // Question is similar to existing ones, update metrics
          const metrics: QuestionMetric[] = similarQuestions.map((similar) => ({
            question_id: similar.questionId,
            video_id: question.video_id,
            channel_id: question.channel_id,
            frequency: 1,
          }));
          const { error: metricsError } = await supabase
            .from("question_metrics")
            .upsert(metrics, { onConflict: "question_id,video_id" });
          if (metricsError) {
            throw metricsError;
          }

          // Update the comment with the cluster_id
          const { error: commentError } = await supabase
            .from("comments")
            .update({ cluster_id: similarQuestions[0].clusterId })
            .eq("id", question.id);

          if (commentError) {
            throw commentError;
          }
        } else {
          // Create new cluster and canonical question
          const clusterId = await this.createCluster(
            question.channel_id,
            question
          );
          await this.storeCanonicalQuestion(
            question.content,
            clusterId,
            question.channel_id,
            question.video_id
          );

          // Update the comment with the new cluster_id
          const { error: commentError } = await supabase
            .from("comments")
            .update({ cluster_id: clusterId })
            .eq("id", question.id);

          if (commentError) {
            throw commentError;
          }
        }
      }
    } catch (error) {
      console.error("Error processing questions batch:", error);
      throw error;
    }
  }

  /**
   * Process all questions that haven't been clustered yet
   */
  static async processUnclusteredQuestions(channelId: string): Promise<void> {
    try {
      const supabase = await createAdminClient();

      const { data: comments, error } = await supabase
        .from("comments")
        .select("*")
        .eq("is_question", true)
        .eq("channel_id", channelId)
        .gt("question_confidence", 0.6)
        .is("cluster_id", null);
      if (error) {
        throw error;
      }
      await this.processQuestionsBatch(comments);
    } catch (error) {
      console.error("Error processing unclustered questions:", error);
      throw error;
    }
  }
}
