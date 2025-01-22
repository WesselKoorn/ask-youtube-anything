"use server";

import { YoutubeVideo } from "@models/youtube-video";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeEmbeddingService } from "@api/services/pinecone-embeddings-service";
import { PineconeSearchResult } from "@models/pinecone-search-result";

export async function uploadVideos(videos: YoutubeVideo[]): Promise<void> {
  try {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error("PINECONE_API_KEY is not set");
    }

    if (!process.env.PINECONE_INDEX_NAME) {
      throw new Error("PINECONE_INDEX_NAME is not set");
    }

    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

    await PineconeEmbeddingService.chunkAndUpsertVideos(
      videos,
      pinecone,
      process.env.PINECONE_INDEX_NAME
    );
  } catch (error) {
    console.error(error);

    throw error;
  }
}

export async function askQuestion(
  channelId: string,
  question: string
): Promise<PineconeSearchResult[]> {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error("PINECONE_API_KEY is not set");
  }

  if (!process.env.PINECONE_INDEX_NAME) {
    throw new Error("PINECONE_INDEX_NAME is not set");
  }

  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

  const matches = await PineconeEmbeddingService.queryChannel(
    question,
    channelId,
    pinecone,
    process.env.PINECONE_INDEX_NAME
  );

  return matches;
}
