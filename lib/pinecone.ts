import { Pinecone } from "@pinecone-database/pinecone";

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

// Get the index for YouTube questions
export const youtubeQuestionsIndex = pinecone.Index("youtube-questions");

// Vector dimension for OpenAI embeddings
export const VECTOR_DIMENSION = 1536;

// Namespace for YouTube questions
export const NAMESPACE = "youtube-questions";

// Helper function to create a vector record
export const createVectorRecord = (
  questionId: string,
  canonicalQuestion: string,
  clusterId: string,
  embedding: number[]
) => ({
  id: questionId,
  values: embedding,
  metadata: {
    question_id: questionId,
    canonical_question: canonicalQuestion,
    cluster_id: clusterId,
    created_at: new Date().toISOString(),
  },
});
