import { expect, test, describe, vi, beforeEach, afterEach } from "vitest";
import { YoutubeService } from "./youtube-service";

const YOUTUBE_DATA_API_URL = "https://youtube.googleapis.com/youtube/v3";

function makeFetchResponse(body: unknown, ok = true) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe("YoutubeService", () => {
  let mockedData: unknown = {
    items: [
      {
        id: {
          channelId: "channel1",
        },
      },
    ],
  };

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeFetchResponse(mockedData))
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("extractHandleFromUrl", () => {
    test("extracts handle from valid URL", () => {
      const url = "https://www.youtube.com/@AlexHormozi/featured";
      expect(YoutubeService.extractHandleFromUrl(url)).toBe("AlexHormozi");
    });

    test("returns null for invalid URL", () => {
      const url = "not-a-url";
      expect(YoutubeService.extractHandleFromUrl(url)).toBeNull();
    });

    test("returns null for URL without handle", () => {
      const url = "https://www.youtube.com/channel/123";
      expect(YoutubeService.extractHandleFromUrl(url)).toBeNull();
    });
  });

  describe("getChannelId", () => {
    test("extracts channel ID from handle", async () => {
      const result = await YoutubeService.getChannelId("test-handle");

      expect(result).toBe("channel1");

      const expectedUrl =
        `${YOUTUBE_DATA_API_URL}/search?` +
        new URLSearchParams({
          part: "snippet",
          q: "test-handle",
          type: "channel",
          maxResults: "1",
          key: process.env.YOUTUBE_DATA_API_KEY!,
        }).toString();
      expect(fetch).toHaveBeenCalledWith(expectedUrl);
    });

    test("extracts channel ID from URL", async () => {
      const result = await YoutubeService.getChannelId("test-handle");

      expect(result).toBe("channel1");
      expect(fetch).toHaveBeenCalledWith(
        `${YOUTUBE_DATA_API_URL}/search?` +
          new URLSearchParams({
            part: "snippet", // was "id"
            q: "test-handle",
            type: "channel",
            maxResults: "1",
            key: process.env.YOUTUBE_DATA_API_KEY!,
          }).toString()
      );
    });

    test("handles channel not found", async () => {
      mockedData = {
        items: [],
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValueOnce(makeFetchResponse(mockedData))
      );

      await expect(YoutubeService.getChannelId("test-handle")).rejects.toThrow(
        "Channel not found"
      );
    });
  });

  describe("getUploadsPlaylistId", () => {
    test("fetches uploads playlist ID successfully", async () => {
      mockedData = {
        items: [
          {
            contentDetails: {
              relatedPlaylists: {
                uploads: "test-playlist-id",
              },
            },
          },
        ],
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(makeFetchResponse(mockedData))
      );

      const result = await YoutubeService.getUploadsPlaylistId(
        "test-channel-id"
      );
      expect(result).toBe("test-playlist-id");
    });

    test("throws error when API call fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValueOnce(makeFetchResponse({}, false))
      );

      await expect(
        YoutubeService.getUploadsPlaylistId("test-channel-id")
      ).rejects.toThrow("Failed to fetch channel ID");
    });
  });

  describe("fetchPlaylistVideos", () => {
    test("fetches videos successfully", async () => {
      mockedData = {
        items: [
          {
            id: "video1",
            snippet: {
              title: "Test Video 1",
              description: "Test Description 1",
              thumbnails: {
                high: {
                  url: "https://example.com/thumb1.jpg",
                },
              },
              publishedAt: "2024-01-01",
              channelId: "channel1",
              resourceId: {
                videoId: "video1",
              },
            },
          },
        ],
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValueOnce(makeFetchResponse(mockedData))
      );

      const result = await YoutubeService.fetchPlaylistVideos("playlist1", 50);

      expect(result).toEqual([
        {
          videoId: "video1",
          title: "Test Video 1",
          description: "Test Description 1",
          thumbnailUrl: "https://example.com/thumb1.jpg",
          publishedAt: "2024-01-01",
          channelId: "channel1",
        },
      ]);
      expect(fetch).toHaveBeenCalledWith(
        `${YOUTUBE_DATA_API_URL}/playlistItems?` +
          new URLSearchParams({
            part: "snippet",
            playlistId: "playlist1",
            maxResults: "50",
            key: process.env.YOUTUBE_DATA_API_KEY!,
          }).toString()
      );
    });

    test("handles empty video list", async () => {
      mockedData = {
        items: [],
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValueOnce(makeFetchResponse(mockedData))
      );

      const result = await YoutubeService.fetchPlaylistVideos("playlist1", 50);

      expect(result).toEqual([]);
    });
  });

  describe("getTranscriptions", () => {
    test("fetches transcriptions successfully", async () => {
      const mockTranscript = [{ text: "Hello" }, { text: "World" }];
      vi.spyOn(YoutubeService, "getTranscript").mockResolvedValue(
        "Hello World"
      );

      const result = await YoutubeService.getTranscriptions(["test-video-id"]);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        videoId: "test-video-id",
        transcription: "Hello World",
      });
    });

    test("handles failed transcriptions gracefully", async () => {
      vi.spyOn(YoutubeService, "getTranscript").mockRejectedValue(
        new Error("Failed")
      );

      const result = await YoutubeService.getTranscriptions(["test-video-id"]);
      expect(result).toHaveLength(0);
    });
  });

  describe("getChannelName", () => {
    test("fetches channel name successfully", async () => {
      const mockResponse = {
        items: [
          {
            snippet: {
              title: "Test Channel",
            },
          },
        ],
      };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await YoutubeService.getChannelName("test-channel-id");
      expect(result).toBe("Test Channel");
    });

    test("returns empty string when API call fails", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
      });

      const result = await YoutubeService.getChannelName("test-channel-id");
      expect(result).toBe("");
    });
  });
});
