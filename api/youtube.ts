"use server";

import { YoutubeService } from "@api/services/youtube-service";
import { YoutubeVideo } from "@models/youtube-video";
import { YoutubeCommentsService } from "@api/services/youtube-comments-service";
import { QuestionDetectionService } from "@api/services/question-detection-service";
import { QuestionClusteringService } from "@api/services/question-clustering-service";
import { createAdminClient } from "@lib/supabase/server";
import { Database } from "@supabase/database.types";
import { isDateAfter } from "@lib/utils";

const MAX_VIDEOS = 50;

type Video = Database["public"]["Tables"]["videos"]["Row"];

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
    console.log("Starting getLastVideos for channel:", channelId);
    if (!channelId) {
      throw new Error("Channel ID is required");
    }

    const supabase = await createAdminClient();

    // Get the latest video date we've seen.
    console.log("Checking for latest video in database...");
    const { data: latestVideo } = await supabase
      .from("videos")
      .select("published_at")
      .eq("channel_id", channelId)
      .order("published_at", { ascending: false })
      .limit(1)
      .single();

    console.log("Latest video date:", latestVideo?.published_at);

    // From the channelId, retrieve the "uploads" playlist ID.
    console.log("Getting uploads playlist ID...");
    const uploadsPlaylistId = await YoutubeService.getUploadsPlaylistId(
      channelId
    );

    if (!uploadsPlaylistId) {
      throw new Error(
        `Could not find an uploads playlist for channel: ${channelId}`
      );
    }
    console.log("Got uploads playlist ID:", uploadsPlaylistId);

    // Fetch last videos from the uploads playlist.
    console.log("Fetching videos from playlist...");
    const videos = await YoutubeService.fetchPlaylistVideos(
      uploadsPlaylistId,
      MAX_VIDEOS
    );
    console.log(`Fetched ${videos.length} videos from playlist`);

    console.log("Videos:", videos);

    // Filter videos by date if we have a latest video.
    const filteredVideos =
      latestVideo?.published_at != null
        ? videos.filter((video) =>
            isDateAfter(video.publishedAt, latestVideo.published_at!)
          )
        : videos;
    console.log(`Filtered to ${filteredVideos.length} new videos`);

    if (filteredVideos.length === 0) {
      console.log("No new videos found, skipping processing");
      return []; // Return empty array if no new videos
    }

    // Get transcriptions for new videos.
    console.log("Getting transcriptions for new videos...");
    const transcriptions = await YoutubeService.getTranscriptions(
      filteredVideos.map((video) => video.videoId)
    );
    console.log(`Got ${transcriptions.length} transcriptions`);

    // Get latest comment.
    const latestComment = await YoutubeCommentsService.getLatestComment(
      channelId
    );

    console.log("Latest comment:", latestComment);

    // Get comments only for new videos
    console.log("Getting channel comments...");
    const comments = await YoutubeCommentsService.getChannelComments(
      channelId,
      latestComment?.published_at ?? ""
    );
    console.log(`Got ${comments.length} comments`);

    if (comments.length > 0) {
      // Store comments in Supabase.
      console.log("Storing comments in Supabase...");
      await YoutubeCommentsService.storeComments(channelId, comments);
      console.log("Comments stored successfully");

      // Process comments through question detection.
      console.log("Getting unprocessed comments...");
      const unprocessedComments =
        await QuestionDetectionService.getUnprocessedComments(channelId);
      console.log(`Found ${unprocessedComments.length} unprocessed comments`);

      // Process comments through question detection.
      console.log("Processing comments through question detection...");
      await QuestionDetectionService.processCommentsBatch(unprocessedComments);
      console.log("Question detection complete");

      // Process questions through clustering.
      console.log("Processing questions through clustering...");
      await QuestionClusteringService.processUnclusteredQuestions(channelId);
      console.log("Question clustering complete");
    } else {
      console.log("No new comments to process");
    }

    // Store new videos in Supabase.
    console.log("Storing new videos in Supabase...");
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
      console.error("Error storing videos:", videoError);
      throw videoError;
    }
    console.log("Videos stored successfully");

    // Add transcriptions to videos.
    console.log("Adding transcriptions to videos...");
    videos.forEach((video) => {
      const transcription = transcriptions.find(
        (transcription) => transcription.videoId === video.videoId
      );

      video.transcription = transcription?.transcription;
    });
    console.log("Transcriptions added to videos");

    return videos;
  } catch (error) {
    console.error("Error in getLastVideos:", error);
    throw error;
  }
}

export async function getChannelVideos(channelId: string): Promise<Video[]> {
  const supabase = await createAdminClient();
  const { data: videos, error } = await supabase
    .from("videos")
    .select("*")
    .eq("channel_id", channelId)
    .order("published_at", { ascending: false });

  if (error) {
    console.error("Error fetching channel videos:", error);
    throw error;
  }

  return videos;
}
