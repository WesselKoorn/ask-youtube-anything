"use server";

import { YoutubeVideoModel } from "@models/youtube-video-model";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeEmbeddingService } from "@api/services/pinecone-embeddings-service";

export async function uploadVideos(videos: YoutubeVideoModel[]): Promise<void> {
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
