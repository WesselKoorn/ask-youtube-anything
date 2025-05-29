import { YoutubeVideo } from "@models/youtube-video";
import { YoutubeTranscript } from "youtube-transcript";

const YOUTUBE_DATA_API_URL = "https://youtube.googleapis.com/youtube/v3";
const YOUTUBE_DATA_API_KEY = process.env.YOUTUBE_DATA_API_KEY || "";

interface PlaylistItem {
  snippet: {
    resourceId: {
      videoId: string;
    };
    title: string;
    description: string;
    publishedAt: string;
    channelId: string;
    channelTitle: string;
    thumbnails: {
      high: {
        url: string;
      };
    };
  };
}

export class YoutubeService {
  /**
   * Extract the handle from a URL like: https://www.youtube.com/@AlexHormozi/featured
   * Returns "AlexHormozi" in this example.
   */
  static extractHandleFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);

      // Typical handle pattern: /@Handle
      // e.g. pathname might be "/@AlexHormozi/featured"
      const pathParts = urlObj.pathname.split("/");

      // Find the part that starts with "@"
      const handlePart = pathParts.find((part) => part.startsWith("@"));

      if (!handlePart) return null;

      // Remove the "@" symbol
      return handlePart.replace("@", "");
    } catch (error) {
      console.error(error);

      return null; // Invalid URL or unexpected format
    }
  }

  /**
   * Use the YouTube "search" endpoint to find a channelId from a given handle.
   * This approach uses "type=channel&q={handle}" to locate the channel.
   */
  static async getChannelId(channelName: string): Promise<string> {
    const channelResponse = await fetch(
      `${YOUTUBE_DATA_API_URL}/channels?` +
        new URLSearchParams({
          part: "snippet",
          forHandle: channelName,
          key: YOUTUBE_DATA_API_KEY,
        }).toString()
    );

    if (!channelResponse.ok) {
      const errorData = await channelResponse.json().catch(() => null);
      console.error("YouTube API error:", {
        status: channelResponse.status,
        statusText: channelResponse.statusText,
        error: JSON.stringify(errorData) ?? "Unknown error",
      });
      throw new Error(
        `Failed to fetch channel ID: ${channelResponse.status} ${channelResponse.statusText}`
      );
    }

    const data = await channelResponse.json();

    if (!data.items || data.items.length === 0) {
      throw new Error("Channel not found");
    }

    const foundChannel = data.items[0];
    console.log("Found channel:", {
      id: foundChannel.id,
      title: foundChannel.snippet.title,
      customUrl: foundChannel.snippet.customUrl,
      handle: channelName
    });

    return foundChannel.id;
  }

  /**
   * From the channelId, get the "uploads" playlist ID via the Channels API.
   */
  static async getUploadsPlaylistId(channelId: string): Promise<string | null> {
    const channelResponse = await fetch(
      `${YOUTUBE_DATA_API_URL}/channels?` +
        new URLSearchParams({
          part: "contentDetails",
          id: channelId,
          key: YOUTUBE_DATA_API_KEY,
        }).toString()
    );

    if (!channelResponse.ok) {
      console.error(
        `YouTube channels API error: ${channelResponse.status} ${channelResponse.statusText}`
      );

      throw new Error(`Failed to fetch channel ${channelId}`);
    }

    const data = await channelResponse.json();
    const channel = data.items?.[0];

    if (!channel?.contentDetails?.relatedPlaylists?.uploads) {
      throw new Error("No uploads playlist found");
    }

    return channel.contentDetails.relatedPlaylists.uploads;
  }

  /**
   * Fetch videos from a playlist with pagination
   */
  static async fetchPlaylistVideos(
    playlistId: string,
    maxResults: number
  ): Promise<YoutubeVideo[]> {
    try {
      const videos: YoutubeVideo[] = [];
      let nextPageToken: string | undefined;

      do {
        const params = new URLSearchParams({
          part: "snippet",
          playlistId: playlistId,
          maxResults: maxResults.toString(),
          key: YOUTUBE_DATA_API_KEY,
        });

        if (nextPageToken) {
          params.set("pageToken", nextPageToken);
        }

        const playlistResponse = await fetch(
          `${YOUTUBE_DATA_API_URL}/playlistItems?` + params.toString()
        );

        if (!playlistResponse.ok) {
          console.error(
            `YouTube playlistItems API error: ${playlistResponse.status} ${playlistResponse.statusText}`
          );

          throw new Error("Failed to fetch playlist videos");
        }

        const data = await playlistResponse.json();

        if (data.items) {
          videos.push(
            ...data.items.map((item: PlaylistItem) => ({
              videoId: item.snippet.resourceId.videoId,
              title: item.snippet.title,
              description: item.snippet.description,
              publishedAt: item.snippet.publishedAt,
              channelId: item.snippet.channelId,
              thumbnailUrl: item.snippet.thumbnails.high.url,
            }))
          );
        }

        nextPageToken = data.nextPageToken;

        // Add a small delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } while (nextPageToken && videos.length < maxResults);

      return videos.slice(0, maxResults);
    } catch (error) {
      console.error("Error fetching playlist videos:", error);
      throw error;
    }
  }

  /**
   * Get transcriptions for multiple videos
   */
  static async getTranscriptions(videoIds: string[]): Promise<
    {
      videoId: string;
      transcription: string | undefined;
    }[]
  > {
    const transcriptions = await Promise.allSettled(
      videoIds.map(async (videoId) => {
        return {
          videoId,
          transcription: await this.getTranscript(videoId),
        };
      })
    );

    const results = transcriptions
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    return results;
  }

  /**
   * Get transcript for a single video using youtube-transcript
   */
  static async getTranscript(videoId: string): Promise<string> {
    const transcriptionArray = await YoutubeTranscript.fetchTranscript(videoId);

    return transcriptionArray.map((item) => item.text).join(" ");
  }

  /**
   * Get the channel name from a channel ID using the YouTube Data API
   */
  static async getChannelName(channelId: string): Promise<string> {
    try {
      const channelResponse = await fetch(
        `${YOUTUBE_DATA_API_URL}/channels?` +
          new URLSearchParams({
            part: "snippet",
            id: channelId,
            key: YOUTUBE_DATA_API_KEY,
          }).toString()
      );

      if (!channelResponse.ok) {
        console.error(
          `YouTube channels API error: ${channelResponse.status} ${channelResponse.statusText}`
        );

        throw new Error("Failed to fetch channel name");
      }

      const data = await channelResponse.json();
      const channel = data.items?.[0];

      if (!channel?.snippet?.title) {
        throw new Error("Channel not found");
      }

      return channel.snippet.title;
    } catch (error) {
      console.error(error);

      return "";
    }
  }
}
