export interface FAQQuestion {
  id: string;
  canonicalQuestion: string;
  clusterId: string;
  frequency: number;
  videoId?: string;
  lastUpdated: Date;
} 