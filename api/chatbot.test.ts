import { expect, test, describe, vi, beforeEach } from "vitest";
import { getAnswer } from "./chatbot";
import { ChatbotService } from "./services/chatbot-service";
import { PineconeSearchResult } from "@models/pinecone-search-result";

// Mock the ChatbotService
vi.mock("./services/chatbot-service", () => ({
  ChatbotService: {
    getAnswer: vi.fn(),
  },
}));

describe("Chatbot Server Actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.OPENAI_API_KEY = "test-api-key";
  });

  describe("getAnswer", () => {
    const mockQuestion = "What is this about?";
    const mockSearchResults: PineconeSearchResult[] = [
      {
        id: "1",
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

    const mockAnswer = {
      answer: "This is a test answer",
      references: [
        {
          videoId: "video1",
          link: "https://www.youtube.com/watch?v=video1",
          title: "Test Video 1",
          publishedAt: "2024-01-01",
        },
      ],
    };

    test("successfully gets answer", async () => {
      vi.mocked(ChatbotService.getAnswer).mockResolvedValue(mockAnswer);

      const result = await getAnswer(mockQuestion, mockSearchResults);

      expect(result).toEqual(mockAnswer);
      expect(ChatbotService.getAnswer).toHaveBeenCalledWith(
        mockQuestion,
        mockSearchResults,
        "test-api-key"
      );
    });

    test("throws error when OpenAI API key is not set", async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(getAnswer(mockQuestion, mockSearchResults)).rejects.toThrow(
        "OPENAI_API_KEY is not set"
      );
    });

    test("handles ChatbotService errors", async () => {
      vi.mocked(ChatbotService.getAnswer).mockRejectedValue(
        new Error("Chatbot service error")
      );

      await expect(getAnswer(mockQuestion, mockSearchResults)).rejects.toThrow(
        "Chatbot service error"
      );
    });
  });
}); 