import OpenAI from "openai";
import { createAdminClient } from "@lib/supabase/server";
import { Database } from '@supabase/database.types';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Comment = Database['public']['Tables']['comments']['Row'];
type CommentUpdate = Database['public']['Tables']['comments']['Update'];

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
  static async processCommentsBatch(comments: Comment[]): Promise<void> {
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
              is_question: isQuestion,
              question_confidence: confidence,
            };
          })
        );

        // Update comments in Supabase
        const { error } = await supabase.from("comments").upsert(
          results.map((comment) => ({
            id: comment.id,
            video_id: comment.video_id,
            channel_id: comment.channel_id,
            author: comment.author,
            content: comment.content,
            published_at: comment.published_at,
            is_question: comment.is_question,
            question_confidence: comment.question_confidence,
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
  static async getUnprocessedComments(channelId: string): Promise<Comment[]> {
    const supabase = await createAdminClient();
    const { data: comments, error } = await supabase
      .from("comments")
      .select("*")
      .eq("channel_id", channelId)
      .is("question_confidence", null)
      .order("published_at", { ascending: false });

    if (error) {
      console.error("Error fetching unprocessed comments:", error);
      throw error;
    }

    console.log(`Found ${comments.length} unprocessed comments`);
    console.log("Sample comments:", comments.slice(0, 3).map(c => ({
      id: c.id,
      is_question: c.is_question,
      question_confidence: c.question_confidence
    })));

    return comments;
  }

  /**
   * Process all unprocessed comments
   */
  static async processUnprocessedComments(channelId: string): Promise<void> {
    try {
      const comments = await this.getUnprocessedComments(channelId);
      await this.processCommentsBatch(comments);
    } catch (error) {
      console.error("Error processing unprocessed comments:", error);
      throw error;
    }
  }

  static async markCommentAsProcessed(
    commentId: string,
    isQuestion: boolean,
    confidence: number
  ): Promise<void> {
    const supabase = await createAdminClient();
    const update: CommentUpdate = {
      is_question: isQuestion,
      question_confidence: confidence,
    };

    const { error } = await supabase
      .from("comments")
      .update(update)
      .eq("id", commentId);

    if (error) {
      console.error("Error marking comment as processed:", error);
      throw error;
    }
  }

  static async detectQuestions(comments: Comment[]): Promise<void> {
    for (const comment of comments) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "You are a question detection system. Analyze the given text and determine if it's a question. Respond with a JSON object containing 'isQuestion' (boolean) and 'confidence' (number between 0 and 1).",
            },
            {
              role: "user",
              content: comment.content,
            },
          ],
          response_format: { type: "json_object" },
        });

        const result = JSON.parse(response.choices[0].message.content || "{}");
        await this.markCommentAsProcessed(
          comment.id,
          result.isQuestion,
          result.confidence
        );
      } catch (error) {
        console.error(`Error processing comment ${comment.id}:`, error);
      }
    }
  }
}
