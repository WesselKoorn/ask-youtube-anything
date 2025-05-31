import { Database } from '@supabase/database.types';
import { createAdminClient } from "@lib/supabase/server";

const YOUTUBE_DATA_API_URL = "https://youtube.googleapis.com/youtube/v3";
const YOUTUBE_DATA_API_KEY = process.env.YOUTUBE_DATA_API_KEY || "";

type Comment = Database['public']['Tables']['comments']['Insert'];

interface CommentThread {
  id: string;
  snippet: {
    videoId: string;
    topLevelComment: {
      snippet: {
        authorDisplayName: string;
        textDisplay: string;
        publishedAt: string;
      };
    };
  };
}

export class YoutubeCommentsService {
  /**
   * Get all comments for a channel with optional date filter
   */
  static async getChannelComments(
    channelId: string,
    afterDate?: string
  ): Promise<Comment[]> {
    console.log("Starting getChannelComments for channel:", channelId);
    const comments: Comment[] = [];
    let nextPageToken: string | undefined;
    let pageCount = 0;

    do {
      try {
        const response = await fetch(
          `${YOUTUBE_DATA_API_URL}/search?key=${YOUTUBE_DATA_API_KEY}&channelId=${channelId}&part=snippet,id&order=date&maxResults=50${
            nextPageToken ? `&pageToken=${nextPageToken}` : ""
          }`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`Fetched page ${++pageCount} of comments`);

        if (!data.items || data.items.length === 0) {
          console.log("No more comments found");
          break;
        }

        // Get comments for each video
        for (const item of data.items) {
          if (item.id.kind === "youtube#video") {
            const videoId = item.id.videoId;
            const videoComments = await this.getVideoComments(videoId, channelId);
            comments.push(...videoComments);
          }
        }

        nextPageToken = data.nextPageToken;
      } catch (error) {
        console.error("Error fetching comments:", error);
        throw error;
      }
    } while (nextPageToken);

    return comments;
  }

  private static async getVideoComments(videoId: string, channelId: string): Promise<Comment[]> {
    try {
      const response = await fetch(
        `${YOUTUBE_DATA_API_URL}/commentThreads?key=${YOUTUBE_DATA_API_KEY}&videoId=${videoId}&part=snippet&maxResults=100`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`Fetched ${data.items?.length || 0} comments for video ${videoId}`);

      if (!data.items || data.items.length === 0) {
        return [];
      }

      return data.items.map((item: CommentThread) => ({
        id: item.id,
        video_id: item.snippet.videoId,
        channel_id: channelId,
        author: item.snippet.topLevelComment.snippet.authorDisplayName,
        content: item.snippet.topLevelComment.snippet.textDisplay,
        published_at: item.snippet.topLevelComment.snippet.publishedAt,
        is_question: false,
        question_confidence: null,
        cluster_id: null,
      }));
    } catch (error) {
      console.error(`Error fetching comments for video ${videoId}:`, error);
      return [];
    }
  }

  /**
   * Store comments in Supabase
   */
  static async storeComments(channelId: string, comments: Comment[]): Promise<void> {
    try {
      console.log(`Starting to store ${comments.length} comments...`);
      console.log("Channel ID:", channelId);
      console.log("Sample comment:", comments[0]);
      
      const supabase = await createAdminClient();

      const { error } = await supabase.from("comments").upsert(
        comments.map((comment) => ({
          ...comment,
          channel_id: channelId,
        })),
        { onConflict: "id" }
      );

      if (error) {
        console.error("Error storing comments:", error);
        throw error;
      }
      console.log("Comments stored successfully");
    } catch (error) {
      console.error("Error in storeComments:", error);
      throw error;
    }
  }
}
