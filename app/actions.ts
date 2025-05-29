"use server";

import { getChannelId } from "@api/youtube";

import { uploadVideos } from "@api/pinecone";
import { getLastVideos } from "@api/youtube";
import { redirect } from "next/navigation";

export async function analyzeChannel(formData: FormData): Promise<void> {
  try {
    console.log("Starting channel analysis...");
    const channelUrl = formData.get("channelUrl") as string;

    if (!channelUrl) {
      throw new Error("Channel URL is required");
    }

    console.log("Getting channel ID for URL:", channelUrl);
    const channelId = await getChannelId(channelUrl);
    console.log("Got channel ID:", channelId);

    console.log("Fetching last videos for channel...");
    const videos = await getLastVideos(channelId);
    console.log(`Fetched ${videos.length} videos`);

    console.log("Uploading videos to Pinecone...");
    await uploadVideos(videos);
    console.log("Videos uploaded to Pinecone successfully");

    console.log("Analysis complete, redirecting to chat...");
    redirect(`/chat/${channelId}`);
  } catch (error) {
    console.error("Error in analyzeChannel:", error);
    throw error;
  }
}
