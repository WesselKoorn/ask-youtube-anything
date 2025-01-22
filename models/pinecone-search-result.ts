/**
 * Search result from Pinecone
 */
export interface PineconeSearchResult {
  id: string;
  score: number;
  metadata: {
    channelId: string;
    videoId: string;
    text?: string;
    title?: string;
    publishedAt?: string;
  };
}