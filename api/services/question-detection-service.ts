import { YoutubeComment } from "@models/youtube-comment";
import OpenAI from "openai";
import { createAdminClient } from "@lib/supabase/server";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class QuestionDetectionService {
  /**
   * Detect if a comment is a question using OpenAI
   */
  static async detectQuestion(
    comment: string
  ): Promise<{ isQuestion: boolean; confidence: number }> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a question detection system. Analyze the given text and determine if it's a question. Respond with a JSON object containing 'isQuestion' (boolean) and 'confidence' (number between 0 and 1).",
          },
          {
            role: "user",
            content: comment,
          },
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return {
        isQuestion: result.isQuestion || false,
        confidence: result.confidence || 0,
      };
    } catch (error) {
      console.error("Error detecting question:", error);
      return { isQuestion: false, confidence: 0 };
    }
  }

  /**
   * Process a batch of comments for question detection
   */
  static async processCommentsBatch(comments: YoutubeComment[]): Promise<void> {
    try {
      const supabase = await createAdminClient();

      // Process comments in parallel with a concurrency limit
      const batchSize = 5;
      for (let i = 0; i < comments.length; i += batchSize) {
        const batch = comments.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (comment) => {
            const { isQuestion, confidence } = await this.detectQuestion(
              comment.content
            );
            return {
              ...comment,
              isQuestion,
              questionConfidence: confidence,
            };
          })
        );

        // Update comments in Supabase
        const { error } = await supabase.from("comments").upsert(
          results.map((comment) => ({
            id: comment.id,
            video_id: comment.videoId,
            author: comment.author,
            content: comment.content,
            published_at: comment.publishedAt,
            is_question: comment.isQuestion,
            question_confidence: comment.questionConfidence,
          })),
          { onConflict: "id" }
        );

        if (error) {
          throw error;
        }

        // Add a small delay between batches to respect rate limits
        if (i + batchSize < comments.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error("Error processing comments batch:", error);
      throw error;
    }
  }

  /**
   * Get unprocessed comments from Supabase that are new
   */
  static async getUnprocessedComments(): Promise<YoutubeComment[]> {
    try {
      const supabase = await createAdminClient();

      // Get the latest processed comment's published_at date
      const { data: latestComment } = await supabase
        .from("comments")
        .select("published_at")
        .is("is_question", null)
        .order("published_at", { ascending: false })
        .limit(1)
        .single();

      // If we have a latest comment, only get comments newer than that
      const query = supabase
        .from("comments")
        .select("*")
        .is("is_question", null);

      if (latestComment?.published_at) {
        query.gt("published_at", latestComment.published_at);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data.map((comment) => ({
        id: comment.id,
        videoId: comment.video_id,
        author: comment.author,
        content: comment.content,
        publishedAt: comment.published_at,
        isQuestion: comment.is_question,
        questionConfidence: comment.question_confidence,
      }));
    } catch (error) {
      console.error("Error getting unprocessed comments:", error);
      throw error;
    }
  }

  /**
   * Process all unprocessed comments
   */
  static async processUnprocessedComments(): Promise<void> {
    try {
      const comments = await this.getUnprocessedComments();

      await this.processCommentsBatch(comments);
    } catch (error) {
      console.error("Error processing unprocessed comments:", error);
      throw error;
    }
  }
}
