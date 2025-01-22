import { PineconeSearchResult } from "@models/pinecone-search-result";
import { YoutubeVideo } from "@models/youtube-video";
import {
  Pinecone,
  RecordMetadata,
  ScoredPineconeRecord,
} from "@pinecone-database/pinecone";
import { OpenAI } from "openai";

/**
 * Chunked data representation for upsert
 */
interface VideoChunk {
  id: string; // Unique chunk ID (channelId-videoId-chunkIndex)
  text: string; // The transcript segment
  channelId: string;
  videoId: string;
  title: string;
  publishedAt: string;
}

export class PineconeEmbeddingService {
  private static CHUNK_SIZE = 500; // tokens or ~words; adjust as needed

  /**
   * Splits each video's transcription into chunks, generates embeddings,
   * and upserts them to Pinecone (skipping duplicates if they exist).
   * @param videos Array of YoutubeVideo
   * @param openAiApiKey Your OpenAI API key
   * @param pineconeClient An initialized Pinecone
   * @param pineconeIndexName The name of your Pinecone index
   */
  static async chunkAndUpsertVideos(
    videos: YoutubeVideo[],
    pineconeClient: Pinecone,
    pineconeIndexName: string
  ): Promise<void> {
    const index = pineconeClient.Index(pineconeIndexName);

    // 1) Chunk transcripts
    const allChunks: VideoChunk[] = [];
    for (const vid of videos) {
      if (!vid.transcription) {
        continue; // Skip videos without transcription
      }

      const chunks = PineconeEmbeddingService.chunkTranscript(
        vid.transcription,
        vid.channelId,
        vid.videoId,
        vid.title,
        vid.publishedAt
      );
      allChunks.push(...chunks);
    }

    // 2) Remove duplicates by checking existing IDs in Pinecone
    //    - We'll batch fetch or check each ID? For large scale, you might do this in batches.
    //    - For simplicity, we do a single fetch with up to 100 IDs at a time:
    const uniqueChunks = await PineconeEmbeddingService.filterDuplicateChunks(
      allChunks,
      index
    );

    if (uniqueChunks.length === 0) {
      console.log("No new chunks to upsert.");
      return;
    }

    // 3) Embed the unique chunks (text only)
    const embeddings = await PineconeEmbeddingService.embedTexts(
      uniqueChunks.map((c) => c.text)
    );

    // 4) Upsert in batches
    const batchSize = 50;
    let batchIndex = 0;

    while (batchIndex < uniqueChunks.length) {
      const end = batchIndex + batchSize;
      const chunkSlice = uniqueChunks.slice(batchIndex, end);
      const embeddingSlice = embeddings.slice(batchIndex, end);

      const upsertRequest = {
        vectors: chunkSlice.map((chunk, i) => ({
          id: chunk.id,
          values: embeddingSlice[i],
          metadata: {
            channelId: chunk.channelId,
            videoId: chunk.videoId,
            title: chunk.title,
            text: chunk.text,
            publishedAt: chunk.publishedAt,
          },
        })),
      };

      await index.upsert(upsertRequest.vectors);

      console.log(
        `Upserted ${upsertRequest.vectors.length} chunks (batch: ${batchIndex} - ${end})`
      );
      batchIndex = end;
    }
  }

  /**
   * Embeds an array of strings using the OpenAI Embeddings API (text-embedding-ada-002).
   * Returns an array of float arrays, one per input text.
   */
  private static async embedTexts(texts: string[]): Promise<number[][]> {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // The embeddings endpoint can process multiple inputs in one request:
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: texts,
    });

    // Each item in response.data.data corresponds to one embedding
    return response.data.map((item) => item.embedding);
  }

  /**
   * Chunks a single video's transcription into smaller segments.
   * For simplicity, this is a naive approach splitting by ~CHUNK_SIZE words.
   * Adjust as needed (e.g., token-based splitting).
   */
  private static chunkTranscript(
    transcription: string,
    channelId: string,
    videoId: string,
    title: string,
    publishedAt: string
  ): VideoChunk[] {
    // Split on whitespace or tokens. Example approach: by words
    const words = transcription.split(/\s+/);
    const chunks: VideoChunk[] = [];

    let start = 0;
    let chunkIndex = 0;

    while (start < words.length) {
      const end = start + PineconeEmbeddingService.CHUNK_SIZE;
      const textSlice = words.slice(start, end).join(" ");

      const chunk: VideoChunk = {
        id: `${channelId}-${videoId}-${chunkIndex}`, // Unique ID
        text: textSlice,
        channelId,
        videoId,
        title,
        publishedAt,
      };

      chunks.push(chunk);
      start = end;
      chunkIndex += 1;
    }
    return chunks;
  }

  /**
   * Filters out chunks that already exist in Pinecone.
   * For large data, we batch the "fetch" calls.
   */
  private static async filterDuplicateChunks(
    chunks: VideoChunk[],
    index: ReturnType<Pinecone["Index"]>
  ): Promise<VideoChunk[]> {
    const chunkIds = chunks.map((c) => c.id);
    const uniqueChunks: VideoChunk[] = [];

    // Pinecone fetch can handle up to 100 IDs per request (soft limit),
    // so let's batch in sets of 100 IDs:
    const batchSize = 100;
    let i = 0;

    while (i < chunkIds.length) {
      const ids = chunkIds.slice(i, i + batchSize);

      const fetchResponse = await index.fetch(ids);
      const foundIds = new Set(Object.keys(fetchResponse.records ?? {}));

      // for each chunk in this slice, if ID wasn't found in Pinecone, it's new
      for (const c of chunks.slice(i, i + batchSize)) {
        if (!foundIds.has(c.id)) {
          uniqueChunks.push(c);
        }
      }

      i += batchSize;
    }

    return uniqueChunks;
  }

  /**
   * Queries the Pinecone index for a given question, filtered by a specific channelId.
   * Returns an array of SearchResult (top matches).
   * topK indicates how many chunks to retrieve.
   */
  static async queryChannel(
    question: string,
    channelId: string,
    pineconeClient: Pinecone,
    pineconeIndexName: string,
    topK = 5
  ): Promise<PineconeSearchResult[]> {
    // 1) Embed the question
    const [questionEmbedding] = await PineconeEmbeddingService.embedTexts([
      question,
    ]);

    // 2) Query Pinecone with filter on channelId
    const index = pineconeClient.Index(pineconeIndexName);
    const queryRequest = {
      vector: questionEmbedding,
      topK,
      includeMetadata: true,
      filter: {
        channelId: channelId, // filter so we only get matches from this channel
      },
    };

    const queryResponse = await index.query(queryRequest);

    // 3) Transform response to a typed SearchResult array
    const matches: PineconeSearchResult[] =
      queryResponse.matches?.map(
        (match: ScoredPineconeRecord<RecordMetadata>) => ({
          id: match.id,
          score: match.score ?? 0,
          metadata: {
            channelId: match.metadata?.channelId?.toString() ?? "",
            videoId: match.metadata?.videoId?.toString() ?? "",
            text: match.metadata?.text?.toString() ?? "",
            title: match.metadata?.title?.toString() ?? "",
            publishedAt: match.metadata?.publishedAt?.toString() ?? "",
          },
        })
      ) ?? [];

    return matches;
  }
}
