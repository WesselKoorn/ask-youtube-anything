"use server";

import { getChannelId } from "@api/youtube";

import { uploadVideos } from "@api/pinecone";
import { getLast10Videos } from "@api/youtube";
import { redirect } from "next/navigation";

export async function analyzeChannel(formData: FormData): Promise<void> {
  try {
    const channelUrl = formData.get("channelUrl") as string;

    if (!channelUrl) {
      throw new Error("Channel URL is required");
    }

    const channelId = await getChannelId(channelUrl);

    const videos = await getLast10Videos(channelId);

    await uploadVideos(videos);

    redirect(`/chat/${channelId}`);
  } catch (error) {
    console.error(error);

    throw error;
  }
}
