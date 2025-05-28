import { createClient } from '@supabase/supabase-js';
import { YoutubeComment } from '@models/youtube-comment';
import { YoutubeCommentResponse } from '@models/youtube-comment-response';

const YOUTUBE_DATA_API_URL = "https://youtube.googleapis.com/youtube/v3";
const YOUTUBE_DATA_API_KEY = process.env.YOUTUBE_DATA_API_KEY || "";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

      const data = await response.json() as YoutubeCommentResponse;

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
   * Process all comments for a video with pagination
   */
  static async processVideoComments(videoId: string): Promise<void> {
    let nextPageToken: string | undefined;
    let totalComments = 0;

    do {
      try {
        // Add a small delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const { comments, nextPageToken: newPageToken } = await this.fetchVideoComments(
          videoId,
          nextPageToken
        );

        await this.storeComments(comments);

        totalComments += comments.length;
        nextPageToken = newPageToken;

        console.log(`Processed ${totalComments} comments for video ${videoId}`);
      } catch (error) {
        console.error(`Error processing comments for video ${videoId}:`, error);
        throw error;
      }
    } while (nextPageToken);
  }

  /**
   * Process comments for multiple videos
   */
  static async processVideosComments(videoIds: string[]): Promise<void> {
    for (const videoId of videoIds) {
      try {
        await this.processVideoComments(videoId);
      } catch (error) {
        console.error(`Failed to process comments for video ${videoId}:`, error);
        // Continue with next video even if one fails
        continue;
      }
    }
  }
} 