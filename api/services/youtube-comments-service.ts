import { YoutubeService } from "@api/services/youtube-service";
import { YoutubeComment } from "@models/youtube-comment";
import { createAdminClient } from "@lib/supabase/server";
import { YoutubeCommentResponse } from "@models/youtube-comment-response";

const YOUTUBE_DATA_API_URL = "https://youtube.googleapis.com/youtube/v3";
const YOUTUBE_DATA_API_KEY = process.env.YOUTUBE_DATA_API_KEY || "";

interface CommentRecord {
  video_id: string;
  published_at: string;
}

export class YoutubeCommentsService {
  /**
   * Fetch comments for a video with pagination and rate limiting
   */
  static async fetchVideoComments(
    videoId: string,
    pageToken?: string,
    maxResults: number = 100
  ): Promise<{ comments: YoutubeComment[]; nextPageToken?: string }> {
    try {
      const response = await fetch(
        `${YOUTUBE_DATA_API_URL}/commentThreads?` +
          new URLSearchParams({
            part: "snippet",
            videoId: videoId,
            maxResults: maxResults.toString(),
            pageToken: pageToken || "",
            key: YOUTUBE_DATA_API_KEY,
          }).toString()
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.statusText}`);
      }

      const data = (await response.json()) as YoutubeCommentResponse;

      const comments: YoutubeComment[] = data.items.map((item) => ({
        id: item.id,
        videoId: videoId,
        author: item.snippet.topLevelComment.snippet.authorDisplayName,
        content: item.snippet.topLevelComment.snippet.textDisplay,
        publishedAt: item.snippet.topLevelComment.snippet.publishedAt,
      }));

      return {
        comments,
        nextPageToken: data.nextPageToken,
      };
    } catch (error) {
      console.error("Error fetching comments:", error);
      throw error;
    }
  }

  /**
   * Store comments in Supabase
   */
  static async storeComments(comments: YoutubeComment[]): Promise<void> {
    try {
      const supabase = await createAdminClient();

      const { error } = await supabase.from("comments").upsert(
        comments.map((comment) => ({
          id: comment.id,
          video_id: comment.videoId,
          author: comment.author,
          content: comment.content,
          published_at: comment.publishedAt,
          is_question: comment.isQuestion || false,
          question_confidence: comment.questionConfidence || null,
        })),
        { onConflict: "id" }
      );

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("Error storing comments:", error);
      throw error;
    }
  }

  /**
   * Process comments for multiple videos
   */
  static async processVideosComments(videoIds: string[]): Promise<void> {
    try {
      const supabase = await createAdminClient();

      // Get the latest comment date we've seen for each video
      const { data: latestComments } = await supabase
        .from("comments")
        .select("video_id, published_at")
        .in("video_id", videoIds)
        .order("published_at", { ascending: false });

      // Create a map of video_id to latest comment date
      const latestCommentDates = new Map<string, string>();
      latestComments?.forEach((comment: CommentRecord) => {
        if (!latestCommentDates.has(comment.video_id)) {
          latestCommentDates.set(comment.video_id, comment.published_at);
        }
      });

      // Process each video
      for (const videoId of videoIds) {
        const latestDate = latestCommentDates.get(videoId);
        await this.processVideoComments(videoId, latestDate);
      }
    } catch (error) {
      console.error("Error processing videos comments:", error);
      throw error;
    }
  }

  /**
   * Process comments for a single video
   */
  private static async processVideoComments(
    videoId: string,
    latestDate?: string
  ): Promise<void> {
    try {
      const supabase = await createAdminClient();

      // Get comments from YouTube API
      const comments = await YoutubeService.getComments(videoId, latestDate);

      if (comments.length === 0) {
        return;
      }

      // Store comments in Supabase
      const { error } = await supabase.from("comments").upsert(
        comments.map((comment: YoutubeComment) => ({
          id: comment.id,
          video_id: comment.videoId,
          author: comment.author,
          content: comment.content,
          published_at: comment.publishedAt,
        })),
        { onConflict: "id" }
      );

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error(`Error processing comments for video ${videoId}:`, error);
      throw error;
    }
  }
}
