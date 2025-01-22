"use server";

import { ChatbotAnswer } from "@models/chatbot-answer";
import { PineconeSearchResult } from "@models/pinecone-search-result";
import { ChatbotService } from "./services/chatbot-service";

export async function getAnswer(
  question: string,
  searchResults: PineconeSearchResult[]
): Promise<ChatbotAnswer> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    const answer = await ChatbotService.getAnswer(
      question,
      searchResults,
      process.env.OPENAI_API_KEY
    );

    return answer;
  } catch (error) {
    console.error(error);

    throw error;
  }
}
