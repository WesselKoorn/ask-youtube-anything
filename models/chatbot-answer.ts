/**
 * The final structure we return from the chatbot service:
 * - The AI-generated "answer"
 * - The references (original video links and optional metadata)
 */
export interface ChatbotAnswer {
  answer: string;
  references: {
    videoId: string;
    link: string;
    title?: string;
    publishedAt?: string;
  }[];
}