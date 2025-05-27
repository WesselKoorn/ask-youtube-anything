import { expect, test, describe, vi, beforeEach, afterEach } from "vitest";
import { PineconeEmbeddingService } from "./pinecone-embeddings-service";
import { YoutubeVideo } from "@models/youtube-video";
import { RecordMetadata } from "@pinecone-database/pinecone";
import { Index } from "@pinecone-database/pinecone";

const mockOpenAIEmbeddingsCreate = vi.fn();

vi.mock("openai", () => {
  return {
    OpenAI: vi.fn().mockImplementation(() => ({
      embeddings: { create: mockOpenAIEmbeddingsCreate },
    })),
  };
});

const mockPineconeIndexFetch = vi.fn().mockResolvedValue({});
const mockPineconeIndexUpsert = vi.fn().mockResolvedValue({});
const mockPineconeIndexQuery = vi.fn().mockResolvedValue({
  matches: [],
});

describe("PineconeEmbeddingService", () => {
  let mockPineconeIndex: Index<RecordMetadata>;

  beforeEach(() => {
    mockPineconeIndex = {
      fetch: mockPineconeIndexFetch,
      upsert: mockPineconeIndexUpsert,
      query: mockPineconeIndexQuery,
    } as unknown as Index<RecordMetadata>;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("chunkAndUpsertVideos", () => {
    test("successfully chunks and upserts videos", async () => {
      const mockVideos: YoutubeVideo[] = [
        {
          videoId: "video1",
          channelId: "channel1",
          title: "Test Video 1",
          description: "Test Description 1",
          thumbnailUrl: "https://example.com/thumb1.jpg",
          publishedAt: "2024-01-01",
          transcription: "This is a test transcription",
        },
      ];

      mockOpenAIEmbeddingsCreate.mockResolvedValueOnce({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      });

      await PineconeEmbeddingService.chunkAndUpsertVideos(
        mockVideos,
        mockPineconeIndex
      );

      expect(mockOpenAIEmbeddingsCreate).toHaveBeenCalledWith({
        model: "text-embedding-ada-002",
        input: expect.any(Array),
      });
      expect(mockPineconeIndexFetch).toHaveBeenCalledWith([
        "channel1-video1-0",
      ]);
    });

    test("skips videos without transcription", async () => {
      const mockVideos: YoutubeVideo[] = [
        {
          videoId: "video1",
          channelId: "channel1",
          title: "Test Video 1",
          description: "Test Description 1",
          thumbnailUrl: "https://example.com/thumb1.jpg",
          publishedAt: "2024-01-01",
        },
      ];

      await PineconeEmbeddingService.chunkAndUpsertVideos(
        mockVideos,
        mockPineconeIndex
      );

      expect(mockOpenAIEmbeddingsCreate).not.toHaveBeenCalled();
    });
  });

  describe("queryChannel", () => {
    test("successfully queries channel", async () => {
      mockPineconeIndexQuery.mockResolvedValueOnce({
        matches: [
          {
            id: "chunk1",
            score: 0.9,
            values: [0.1, 0.2, 0.3],
            metadata: {
              channelId: "channel1",
              videoId: "video1",
              text: "Test text 1",
              title: "Test Video 1",
              publishedAt: "2024-01-01",
            },
          },
        ],
        namespace: "test-namespace",
      });

      mockOpenAIEmbeddingsCreate.mockResolvedValueOnce({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      });

      const result = await PineconeEmbeddingService.queryChannel(
        "test query",
        "channel1",
        mockPineconeIndex
      );

      expect(result).toEqual([
        {
          id: "chunk1",
          score: 0.9,
          metadata: {
            channelId: "channel1",
            videoId: "video1",
            text: "Test text 1",
            title: "Test Video 1",
            publishedAt: "2024-01-01",
          },
        },
      ]);
    });

    test("handles empty results", async () => {
      mockPineconeIndexQuery.mockResolvedValueOnce({
        matches: [],
        namespace: "test-namespace",
      });

      mockOpenAIEmbeddingsCreate.mockResolvedValueOnce({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      });

      const result = await PineconeEmbeddingService.queryChannel(
        "test query",
        "channel1",
        mockPineconeIndex
      );

      expect(result).toEqual([]);
    });
  });
});
