export interface FAQFilter {
  channelId: string;
  videoId?: string;
  startDate?: Date;
  endDate?: Date;
  searchQuery?: string;
  minFrequency?: number;
} 