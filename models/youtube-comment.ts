import { Database } from "@supabase/database.types";

export type YoutubeComment = Database['public']['Tables']['comments']['Row'];