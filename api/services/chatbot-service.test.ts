import { expect, test, describe, vi, afterEach } from "vitest";
import { ChatbotService } from "./chatbot-service";
import { PineconeSearchResult } from "@models/pinecone-search-result";

const mockCreate = vi.fn();

vi.mock("openai", () => {
  return {
    // replace the OpenAI export with a dummy class
    OpenAI: vi.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
  };
});

describe("ChatbotService", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getAnswer", () => {
    const mockSearchResults: PineconeSearchResult[] = [
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
    ];

    test("generates answer successfully", async () => {
      mockCreate.mockResolvedValueOnce({
        id: "chatcmpl-123",
        created: 1677652288,
        model: "gpt-4",
        object: "chat.completion",
        choices: [
          {
            message: {
              content: "This is a test answer",
              role: "assistant",
              refusal: "none",
            },
            finish_reason: "stop",
            index: 0,
            logprobs: null,
          },
        ],
      });

      const result = await ChatbotService.getAnswer(
        "test question",
        mockSearchResults,
        "test-api-key"
      );

      expect(result).toEqual({
        answer: "This is a test answer",
        references: [
          {
            videoId: "video1",
            title: "Test Video 1",
            link: "https://www.youtube.com/watch?v=video1",
            publishedAt: "2024-01-01",
          },
        ],
      });
      expect(mockCreate).toHaveBeenCalledWith({
        model: "gpt-3.5-turbo",
        messages: expect.any(Array),
        temperature: 0.7,
      });
    });

    test("handles empty search results", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "This is a test answer",
            },
          },
        ],
      });

      const result = await ChatbotService.getAnswer(
        "test question",
        [],
        "test-api-key"
      );

      expect(result).toEqual({
        answer: "This is a test answer",
        references: [],
      });
      expect(mockCreate).toHaveBeenCalledWith({
        model: "gpt-3.5-turbo",
        messages: expect.any(Array),
        temperature: 0.7,
      });
    });

    test("handles OpenAI API errors", async () => {
      mockCreate.mockRejectedValueOnce(new Error("API Error"));

      await expect(
        ChatbotService.getAnswer(
          "test question",
          mockSearchResults,
          "test-api-key"
        )
      ).rejects.toThrow("API Error");
    });
  });
});
