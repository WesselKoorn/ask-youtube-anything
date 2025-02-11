"use server";

import { YoutubeService } from "@api/services/youtube-service";
import { YoutubeVideo } from "@models/youtube-video";

const MAX_VIDEOS = 100;

export async function getChannelId(channelUrl: string): Promise<string> {
  try {
    if (!channelUrl) {
      throw new Error("Channel URL is required");
    }

    // 1. Extract the handle (e.g., "AlexHormozi") from the URL
    const handle = YoutubeService.extractHandleFromUrl(channelUrl);

    if (!handle) {
      throw new Error(`Could not parse a handle from URL: ${channelUrl}`);
    }

    // 2. Convert handle to channelId via YouTube Search API
    const channelId = await YoutubeService.getChannelId(handle);

    if (!channelId) {
      throw new Error(`Channel not found for handle: ${handle}`);
    }

    return channelId;
  } catch (error) {
    console.error(error);

    throw error;
  }
}

/**
 * Main function to get the 10 latest videos from a channel URL like:
 *   https://www.youtube.com/@AlexHormozi/featured
 */
export async function getLastVideos(
  channelId: string
): Promise<YoutubeVideo[]> {
  try {
    if (!channelId) {
      throw new Error("Channel ID is required");
    }

    // 3. From the channelId, retrieve the "uploads" playlist ID
    const uploadsPlaylistId = await YoutubeService.getUploadsPlaylistId(
      channelId
    );

    if (!uploadsPlaylistId) {
      throw new Error(
        `Could not find an uploads playlist for channel: ${channelId}`
      );
    }

    // 4. Fetch last videos from the uploads playlist
    const videos = await YoutubeService.fetchPlaylistVideos(
      uploadsPlaylistId,
      MAX_VIDEOS
    );

    const transcriptions = await YoutubeService.getTranscriptions(
      videos.map((video) => video.videoId)
    );

    videos.forEach((video) => {
      const transcription = transcriptions.find(
        (transcription) => transcription.videoId === video.videoId
      );

      video.transcription = transcription?.transcription;
    });

    return videos;
  } catch (error) {
    console.error(error);

    throw error;
  }
}
