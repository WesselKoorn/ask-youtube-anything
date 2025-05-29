export interface YoutubeComment {
  id: string;
  videoId: string;
  author: string;
  content: string;
  publishedAt: string;
  isQuestion?: boolean;
  questionConfidence?: number;
  clusterId?: string;
}