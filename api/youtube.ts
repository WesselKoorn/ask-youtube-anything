"use server";

import { YoutubeService } from "@api/services/youtube-service";
import { YoutubeVideo } from "@models/youtube-video";
import { YoutubeCommentsService } from "@api/services/youtube-comments-service";
import { QuestionDetectionService } from "@api/services/question-detection-service";
import { QuestionClusteringService } from "@api/services/question-clustering-service";
import { createAdminClient } from "@lib/supabase/server";

const MAX_VIDEOS = 50;

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

    const supabase = await createAdminClient();

    // Get the latest video date we've seen
    const { data: latestVideo } = await supabase
      .from("videos")
      .select("published_at")
      .order("published_at", { ascending: false })
      .limit(1)
      .single();

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

    // Filter videos by date if we have a latest video
    const filteredVideos = latestVideo?.published_at
      ? videos.filter(
          (video) =>
            new Date(video.publishedAt) > new Date(latestVideo.published_at)
        )
      : videos;

    if (filteredVideos.length === 0) {
      return videos; // Return all videos if no new ones
    }

    // 5. Get transcriptions for new videos
    const transcriptions = await YoutubeService.getTranscriptions(
      filteredVideos.map((video) => video.videoId)
    );

    // 6. Get comments for new videos
    await YoutubeCommentsService.processVideosComments(
      filteredVideos.map((video) => video.videoId)
    );

    // 7. Process comments through question detection
    const unprocessedComments =
      await QuestionDetectionService.getUnprocessedComments();
    await QuestionDetectionService.processCommentsBatch(unprocessedComments);

    // 8. Process questions through clustering
    await QuestionClusteringService.processUnclusteredQuestions();

    // Store new videos in Supabase
    const { error: videoError } = await supabase.from("videos").upsert(
      filteredVideos.map((video) => ({
        id: video.videoId,
        title: video.title,
        description: video.description,
        published_at: video.publishedAt,
        channel_id: video.channelId,
        thumbnail_url: video.thumbnailUrl,
      })),
      { onConflict: "id" }
    );

    if (videoError) {
      throw videoError;
    }

    // Add transcriptions to videos
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
