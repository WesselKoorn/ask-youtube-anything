import { YoutubeComment } from "@models/youtube-comment";
import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { ScoredPineconeRecord } from "@pinecone-database/pinecone";
import { createAdminClient } from "@lib/supabase/server";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

// Get the index for YouTube questions
const youtubeQuestionsIndex = pinecone.Index("youtube-questions");

export class QuestionClusteringService {
  /**
   * Get embedding for a question using OpenAI
   * @private
   */
  private static async getEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
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
  private static async createCluster(question: string): Promise<string> {
    try {
      const supabase = await createAdminClient();

      const { data: cluster, error } = await supabase
        .from("question_clusters")
        .insert({ name: question })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return cluster.id;
    } catch (error) {
      console.error("Error creating cluster:", error);
      throw error;
    }
  }

  /**
   * Store a canonical question in Supabase and Pinecone
   * @private
   */
  private static async storeCanonicalQuestion(
    question: string,
    clusterId: string
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
            created_at: new Date().toISOString(),
          },
        },
      ]);

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
    threshold: number = 0.8
  ): Promise<{ questionId: string; similarity: number }[]> {
    try {
      const embedding = await this.getEmbedding(question);
      const results = await youtubeQuestionsIndex.query({
        vector: embedding,
        topK: 5,
        includeMetadata: true,
      });
      return results.matches
        .filter(
          (match: ScoredPineconeRecord) => (match.score || 0) >= threshold
        )
        .map((match: ScoredPineconeRecord) => ({
          questionId: match.metadata?.question_id as string,
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
    comments: YoutubeComment[]
  ): Promise<void> {
    try {
      const supabase = await createAdminClient();

      // Filter for comments that are questions with high confidence
      const questions = comments.filter(
        (comment) =>
          comment.isQuestion && (comment.questionConfidence || 0) > 0.8
      );
      for (const question of questions) {
        // Find similar questions
        const similarQuestions = await this.findSimilarQuestions(
          question.content
        );
        if (similarQuestions.length > 0) {
          // Question is similar to existing ones, update metrics
          const { error } = await supabase.from("question_metrics").upsert(
            similarQuestions.map((similar) => ({
              question_id: similar.questionId,
              video_id: question.videoId,
              frequency: 1,
            })),
            { onConflict: "question_id,video_id" }
          );
          if (error) {
            throw error;
          }
        } else {
          // Create new cluster and canonical question
          const clusterId = await this.createCluster(question.content);
          await this.storeCanonicalQuestion(question.content, clusterId);
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
  static async processUnclusteredQuestions(): Promise<void> {
    try {
      const supabase = await createAdminClient();

      const { data: comments, error } = await supabase
        .from("comments")
        .select("*")
        .eq("is_question", true)
        .is("cluster_id", null);
      if (error) {
        throw error;
      }
      const youtubeComments: YoutubeComment[] = comments.map((comment) => ({
        id: comment.id,
        videoId: comment.video_id,
        author: comment.author,
        content: comment.content,
        publishedAt: comment.published_at,
        isQuestion: comment.is_question,
        questionConfidence: comment.question_confidence,
      }));
      await this.processQuestionsBatch(youtubeComments);
    } catch (error) {
      console.error("Error processing unclustered questions:", error);
      throw error;
    }
  }
}
