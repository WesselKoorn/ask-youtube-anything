export interface YoutubeCommentResponse {
  items: Array<{
    id: string;
    snippet: {
      topLevelComment: {
        snippet: {
          authorDisplayName: string;
          textDisplay: string;
          publishedAt: string;
        };
      };
    };
  }>;
  nextPageToken?: string;
} 