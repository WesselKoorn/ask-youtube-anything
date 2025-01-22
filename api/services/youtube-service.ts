import { YoutubeVideo } from "@models/youtube-video";
import { YoutubeTranscript } from "youtube-transcript";

const YOUTUBE_DATA_API_URL = "https://youtube.googleapis.com/youtube/v3";
const YOUTUBE_DATA_API_KEY = process.env.YOUTUBE_DATA_API_KEY || "";

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
    // TODO: Search is an expensive call, see if we can omit it.
    const searchResponse = await fetch(
      `${YOUTUBE_DATA_API_URL}/search?` +
        new URLSearchParams({
          part: "snippet", // was "id"
          q: channelName,
          type: "channel",
          maxResults: "1",
          key: YOUTUBE_DATA_API_KEY,
        }).toString()
    );

    if (!searchResponse.ok) {
      throw new Error("Failed to fetch channel ID");
    }

    const searchData = await searchResponse.json();

    if (!searchData.items || searchData.items.length === 0) {
      throw new Error("No channel found");
    }

    return searchData.items[0].id.channelId;
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

      throw new Error("Failed to fetch channel ID");
    }

    const data = await channelResponse.json();
    const channel = data.items?.[0];

    if (!channel?.contentDetails?.relatedPlaylists?.uploads) {
      throw new Error("No uploads playlist found");
    }

    return channel.contentDetails.relatedPlaylists.uploads;
  }

  /**
   * Fetch up to 'maxResults' videos from an 'uploads' playlist via the PlaylistItems API.
   */
  static async fetchPlaylistVideos(
    playlistId: string,
    maxResults: number
  ): Promise<YoutubeVideo[]> {
    const playlistResponse = await fetch(
      `${YOUTUBE_DATA_API_URL}/playlistItems?` +
        new URLSearchParams({
          part: "snippet",
          playlistId: playlistId,
          maxResults: maxResults.toString(),
          key: YOUTUBE_DATA_API_KEY,
        }).toString()
    );

    if (!playlistResponse.ok) {
      console.error(
        `YouTube playlistItems API error: ${playlistResponse.status} ${playlistResponse.statusText}`
      );

      throw new Error("Failed to fetch playlist videos");
    }

    const data = await playlistResponse.json();

    console.log("Items:", data.items);

    const videos: YoutubeVideo[] =
      data.items?.map(
        (item: {
          id: string;
          snippet: {
            title: string;
            description: string;
            thumbnails: {
              high: { url: string };
            };
            publishedAt: string;
            channelId: string;
            resourceId: {
              videoId: string;
            };
          };
        }) => {
          const video: YoutubeVideo = {
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnailUrl: item.snippet.thumbnails.high.url,
            publishedAt: item.snippet.publishedAt,
            videoId: item.snippet.resourceId.videoId,
            channelId: item.snippet.channelId,
          };

          return video;
        }
      ) ?? [];

    return videos;
  }

  static async getTranscriptions(videoIds: string[]): Promise<string[]> {
    const transcriptions = await Promise.all(
      videoIds.map((videoId) => this.getTranscript(videoId))
    );

    return transcriptions;
  }

  static async getTranscript(videoId: string): Promise<string> {
    const transcriptionArray = await YoutubeTranscript.fetchTranscript(videoId);

    return transcriptionArray.map((item) => item.text).join(" ");
  }
}
