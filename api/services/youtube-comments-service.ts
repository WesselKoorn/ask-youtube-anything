import { YoutubeComment } from "@models/youtube-comment";
import { createAdminClient } from "@lib/supabase/server";

const YOUTUBE_DATA_API_URL = "https://youtube.googleapis.com/youtube/v3";
const YOUTUBE_DATA_API_KEY = process.env.YOUTUBE_DATA_API_KEY || "";

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
  ): Promise<YoutubeComment[]> {
    console.log("Starting getChannelComments for channel:", channelId);
    const comments: YoutubeComment[] = [];
    let nextPageToken: string | undefined;
    let pageCount = 0;

    do {
      pageCount++;
      console.log(`Fetching comments page ${pageCount}...`);

      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const params = new URLSearchParams({
        part: "snippet",
        allThreadsRelatedToChannelId: channelId,
        maxResults: "100",
        publishedAfter: afterDate ?? oneYearAgo.toISOString(),
        key: YOUTUBE_DATA_API_KEY,
        order: "time",
        sortOrder: "descending",
      });

      if (nextPageToken) {
        params.set("pageToken", nextPageToken);
      }

      console.log(
        `Fetching comments after ${afterDate ?? oneYearAgo.toISOString()}`
      );

      const response = await fetch(
        `${YOUTUBE_DATA_API_URL}/commentThreads?${params.toString()}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error("YouTube API error:", {
          status: response.status,
          statusText: response.statusText,
          error: JSON.stringify(errorData) ?? "Unknown error",
        });
        throw new Error(
          `Failed to fetch channel comments: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      nextPageToken = data.nextPageToken;

      if (!data.items) {
        console.log("No items in response, continuing...");
        continue;
      }

      console.log("Comments received:", data.items.length);
      // Log the first few comments to debug
      console.log("Sample comments:", data.items.slice(0, 3).map((item: CommentThread) => ({
        videoId: item.snippet.videoId,
        content: item.snippet.topLevelComment.snippet.textDisplay,
        author: item.snippet.topLevelComment.snippet.authorDisplayName
      })));

      const newComments = data.items.map((item: CommentThread) => ({
        id: item.id,
        videoId: item.snippet.videoId,
        author: item.snippet.topLevelComment.snippet.authorDisplayName,
        content: item.snippet.topLevelComment.snippet.textDisplay,
        publishedAt: item.snippet.topLevelComment.snippet.publishedAt,
      }));

      console.log(
        `Found ${newComments.length} new comments on page ${pageCount}`
      );
      comments.push(...newComments);

      if (
        afterDate &&
        newComments.length > 0 &&
        new Date(newComments[newComments.length - 1].publishedAt) <=
          new Date(afterDate)
      ) {
        console.log(
          `Found comments older than ${afterDate} (oldest in this page: ${
            newComments[newComments.length - 1].publishedAt
          }), stopping pagination`
        );
        break;
      }

      if (!nextPageToken) {
        console.log("No more pages to fetch");
        break;
      }
    } while (nextPageToken);

    console.log(`Finished fetching comments. Total: ${comments.length}`);
    return comments;
  }

  /**
   * Store comments in Supabase
   */
  static async storeComments(comments: YoutubeComment[]): Promise<void> {
    try {
      console.log(`Starting to store ${comments.length} comments...`);
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
          cluster_id: comment.clusterId || null,
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
