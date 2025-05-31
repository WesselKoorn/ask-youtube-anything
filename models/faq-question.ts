import { Database } from "@supabase/database.types";

type BaseQuestion = Database['public']['Tables']['questions']['Row'];

export interface FAQQuestion extends BaseQuestion {
  frequency: number;
  lastUpdated: string;
} 