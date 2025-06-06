import { expect, test, describe, vi, beforeEach } from "vitest";
import { getChannelId, getLastVideos } from "./youtube";
import { YoutubeService } from "./services/youtube-service";
import { YoutubeCommentsService } from "./services/youtube-comments-service";
import { createAdminClient } from "@lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@supabase/database.types";

// Mock all required services
vi.mock("./services/youtube-service", () => ({
  YoutubeService: {
    extractHandleFromUrl: vi.fn(),
    getChannelId: vi.fn(),
    getUploadsPlaylistId: vi.fn(),
    fetchPlaylistVideos: vi.fn(),
    getTranscriptions: vi.fn(),
  },
}));

vi.mock("./services/youtube-comments-service", () => ({
  YoutubeCommentsService: {
    getLatestComment: vi.fn(),
    getChannelComments: vi.fn(),
    storeComments: vi.fn(),
  },
}));

vi.mock("./services/question-detection-service", () => ({
  QuestionDetectionService: {
    getUnprocessedComments: vi.fn(),
    processCommentsBatch: vi.fn(),
  },
}));

vi.mock("./services/question-clustering-service", () => ({
  QuestionClusteringService: {
    processUnclusteredQuestions: vi.fn(),
  },
}));

// Mock Supabase client
vi.mock("@lib/supabase/server", () => ({
  createAdminClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  }),
}));

describe("YouTube Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getChannelId", () => {
    test("successfully gets channel ID from URL", async () => {
      const mockUrl = "https://www.youtube.com/@testchannel";
      const mockHandle = "testchannel";
      const mockChannelId = "channel123";

      vi.mocked(YoutubeService.extractHandleFromUrl).mockReturnValue(
        mockHandle
      );
      vi.mocked(YoutubeService.getChannelId).mockResolvedValue(mockChannelId);

      const result = await getChannelId(mockUrl);

      expect(result).toBe(mockChannelId);
      expect(YoutubeService.extractHandleFromUrl).toHaveBeenCalledWith(mockUrl);
      expect(YoutubeService.getChannelId).toHaveBeenCalledWith(mockHandle);
    });

    test("throws error for invalid URL", async () => {
      vi.mocked(YoutubeService.extractHandleFromUrl).mockImplementation(() => {
        throw new Error("Invalid URL");
      });

      await expect(getChannelId("not-a-url")).rejects.toThrow("Invalid URL");
      expect(YoutubeService.extractHandleFromUrl).toHaveBeenCalledWith(
        "not-a-url"
      );
    });

    test("throws error when handle cannot be extracted", async () => {
      vi.mocked(YoutubeService.extractHandleFromUrl).mockReturnValue(null);

      await expect(
        getChannelId("https://www.youtube.com/@testchannel")
      ).rejects.toThrow(
        "Could not parse a handle from URL: https://www.youtube.com/@testchannel"
      );
    });
  });

  describe("getLastVideos", () => {
    const mockChannelId = "channel123";
    const mockPlaylistId = "playlist123";
    const mockVideos = [
      {
        title: "Test Video 1",
        description: "Test Description 1",
        thumbnailUrl: "test-url-1",
        publishedAt: "2024-01-01",
        videoId: "video1",
        channelId: mockChannelId,
      },
      {
        title: "Test Video 2",
        description: "Test Description 2",
        thumbnailUrl: "test-url-2",
        publishedAt: "2024-01-02",
        videoId: "video2",
        channelId: mockChannelId,
      },
    ];

    beforeEach(() => {
      // Mock Supabase responses
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };

      vi.mocked(createAdminClient).mockResolvedValue(
        mockSupabase as unknown as SupabaseClient<Database>
      );
    });

    test("successfully gets last videos with transcriptions", async () => {
      vi.mocked(YoutubeService.getUploadsPlaylistId).mockResolvedValue(
        mockPlaylistId
      );
      vi.mocked(YoutubeService.fetchPlaylistVideos).mockResolvedValue(
        mockVideos
      );
      vi.mocked(YoutubeService.getTranscriptions).mockResolvedValue([
        { videoId: "video1", transcription: "Test transcription 1" },
        { videoId: "video2", transcription: "Test transcription 2" },
      ]);
      vi.mocked(YoutubeCommentsService.getLatestComment).mockResolvedValue(
        null
      );
      vi.mocked(YoutubeCommentsService.getChannelComments).mockResolvedValue(
        []
      );

      const result = await getLastVideos(mockChannelId);

      expect(result).toHaveLength(2);
      expect(result[0].transcription).toBe("Test transcription 1");
      expect(result[1].transcription).toBe("Test transcription 2");

      expect(YoutubeService.getUploadsPlaylistId).toHaveBeenCalledWith(
        mockChannelId
      );
      expect(YoutubeService.fetchPlaylistVideos).toHaveBeenCalledWith(
        mockPlaylistId,
        50
      );
      expect(YoutubeService.getTranscriptions).toHaveBeenCalledWith([
        "video1",
        "video2",
      ]);
    });

    test("throws error when uploads playlist cannot be found", async () => {
      vi.mocked(YoutubeService.getUploadsPlaylistId).mockResolvedValue(null);

      await expect(getLastVideos(mockChannelId)).rejects.toThrow(
        "Could not find an uploads playlist for channel: channel123"
      );
    });

    test("handles missing transcriptions gracefully", async () => {
      vi.mocked(YoutubeService.getUploadsPlaylistId).mockResolvedValue(
        mockPlaylistId
      );
      vi.mocked(YoutubeService.fetchPlaylistVideos).mockResolvedValue(
        mockVideos
      );
      vi.mocked(YoutubeService.getTranscriptions).mockResolvedValue([
        { videoId: "video1", transcription: "Test transcription 1" },
        // video2 transcription is missing
      ]);
      vi.mocked(YoutubeCommentsService.getLatestComment).mockResolvedValue(
        null
      );
      vi.mocked(YoutubeCommentsService.getChannelComments).mockResolvedValue(
        []
      );

      const result = await getLastVideos(mockChannelId);

      expect(result).toHaveLength(2);
      expect(result[0].transcription).toBe("Test transcription 1");
      expect(result[1].transcription).toBeUndefined();
    });
  });
});
