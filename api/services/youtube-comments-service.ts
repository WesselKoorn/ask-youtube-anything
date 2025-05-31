import { Database } from "@supabase/database.types";
import { createAdminClient } from "@lib/supabase/server";
import { isDateAfter } from "@lib/utils";

const YOUTUBE_DATA_API_URL = "https://youtube.googleapis.com/youtube/v3";
const YOUTUBE_DATA_API_KEY = process.env.YOUTUBE_DATA_API_KEY || "";

type Comment = Database["public"]["Tables"]["comments"]["Insert"];

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
  static async getLatestComment(channelId: string): Promise<Comment | null> {
    console.log("Getting latest comment for channel:", channelId);
    const supabase = await createAdminClient();

    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .eq("channel_id", channelId)
      .order("published_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Error getting latest comment:", error);
      throw error;
    }

    return data[0] || null;
  }
  /**
   * Get all comments for a channel with optional date filter
   */
  static async getChannelComments(
    channelId: string,
    afterDate?: string
  ): Promise<Comment[]> {
    console.log(
      `Starting getChannelComments for channel: ${channelId} after date: ${afterDate}`
    );

    const comments: Comment[] = [];
    let nextPageToken: string | undefined;
    let pageCount = 0;

    do {
      try {
        const response = await fetch(
          `${YOUTUBE_DATA_API_URL}/commentThreads?key=${YOUTUBE_DATA_API_KEY}&part=snippet&allThreadsRelatedToChannelId=${channelId}&maxResults=100${
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

        // Map comment threads to our Comment type
        const newComments = data.items.map((item: CommentThread) => ({
          id: item.id,
          video_id: item.snippet.videoId,
          channel_id: channelId,
          author: item.snippet.topLevelComment.snippet.authorDisplayName,
          content: item.snippet.topLevelComment.snippet.textDisplay,
          published_at: item.snippet.topLevelComment.snippet.publishedAt,
          is_question: null,
          question_confidence: null,
          cluster_id: null,
        }));

        // Filter by date if needed
        const filteredComments = afterDate
          ? newComments.filter((comment: Comment) =>
              isDateAfter(comment.published_at, afterDate)
            )
          : newComments;

        comments.push(...filteredComments);

        nextPageToken = data.nextPageToken;
      } catch (error) {
        console.error("Error fetching comments:", error);
        throw error;
      }
    } while (nextPageToken);

    return comments;
  }

  /**
   * Store comments in Supabase
   */
  static async storeComments(
    channelId: string,
    comments: Comment[]
  ): Promise<void> {
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
