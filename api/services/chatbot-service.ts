import { ChatbotAnswer } from "@models/chatbot-answer";
import { PineconeSearchResult } from "@models/pinecone-search-result";
import { OpenAI } from "openai";

/**
 * This class uses OpenAI's ChatCompletion to generate an answer from the user question
 * and a set of Pinecone search results (transcript snippets).
 */
export class ChatbotService {
  /**
   * Generates an answer using the relevant search results from Pinecone as context.
   *
   * @param question The user's question (e.g., "How do I optimize my sales funnel?")
   * @param searchResults The top Pinecone matches (transcript snippets and metadata)
   * @param openAiApiKey Your OpenAI API key
   * @returns A structured answer plus references to the original videos
   */
  static async getAnswer(
    question: string,
    searchResults: PineconeSearchResult[],
    openAiApiKey: string
  ): Promise<ChatbotAnswer> {
    // 1. Build a string that includes the relevant snippets + their source info
    //    We'll call this our "context" that the AI can reference.
    const contextString = searchResults
      .map((res, i) => {
        return `
Source #${i + 1}
Title: ${res.metadata.title ?? "Untitled"}
Link: https://www.youtube.com/watch?v=${res.metadata.videoId}
Transcript snippet: "${res.metadata.text}"
        `.trim();
      })
      .join("\n\n");

    // 2. Prepare system & user messages for ChatCompletion
    // System message can instruct the AI to reference the provided context.
    const systemMessage = {
      role: "system" as const,
      content: `
You are a helpful assistant who uses the provided context from YouTube videos to answer questions.
Provide as much detail as needed, and when you do, try to reference the sources in your answer.
If you're unsure, say so.
      `.trim(),
    };

    // User message includes the context plus the actual question
    const userMessage = {
      role: "user" as const,
      content: `
Here is some context from the user's videos:

${contextString}

Now, answer the user's question using *only* the above context. 
If it's not covered, say you are unsure.

User's question: "${question}"
      `.trim(),
    };

    // 3. Call OpenAI ChatCompletion
    const openai = new OpenAI({ apiKey: openAiApiKey });

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [systemMessage, userMessage],
      temperature: 0.7, // adjust for creativity
    });

    const aiAnswer = response.choices[0].message?.content ?? "No answer";

    // 4. Build references array from your searchResults
    //    (In this example, we simply attach all top-5 or top-K results as references.)
    //    Remove duplicates if there are any.
    const references = searchResults
      .map((res) => {
        return {
          videoId: res.metadata.videoId,
          link: `https://www.youtube.com/watch?v=${res.metadata.videoId}`,
          title: res.metadata.title,
          publishedAt: res.metadata.publishedAt,
        };
      })
      .filter((res, index, self) => {
        return self.findIndex((t) => t.videoId === res.videoId) === index;
      });

    // 5. Return answer + references in a structured format
    const chatbotAnswer: ChatbotAnswer = {
      answer: aiAnswer,
      references,
    };

    return chatbotAnswer;
  }
}
