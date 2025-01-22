export interface YoutubeVideoModel {
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
  videoId: string;
  channelId: string;
  transcription?: string;
}
