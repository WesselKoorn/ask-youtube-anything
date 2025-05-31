export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      comments: {
        Row: {
          author: string
          channel_id: string
          cluster_id: string | null
          content: string
          created_at: string | null
          id: string
          is_question: boolean | null
          published_at: string
          question_confidence: number | null
          video_id: string
        }
        Insert: {
          author: string
          channel_id: string
          cluster_id?: string | null
          content: string
          created_at?: string | null
          id: string
          is_question?: boolean | null
          published_at: string
          question_confidence?: number | null
          video_id: string
        }
        Update: {
          author?: string
          channel_id?: string
          cluster_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_question?: boolean | null
          published_at?: string
          question_confidence?: number | null
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "question_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      question_clusters: {
        Row: {
          channel_id: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      question_metrics: {
        Row: {
          channel_id: string
          frequency: number | null
          id: string
          last_updated: string | null
          question_id: string | null
          video_id: string
        }
        Insert: {
          channel_id: string
          frequency?: number | null
          id?: string
          last_updated?: string | null
          question_id?: string | null
          video_id: string
        }
        Update: {
          channel_id?: string
          frequency?: number | null
          id?: string
          last_updated?: string | null
          question_id?: string | null
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_metrics_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          canonical_question: string
          channel_id: string
          cluster_id: string | null
          created_at: string | null
          id: string
          pinecone_id: string
        }
        Insert: {
          canonical_question: string
          channel_id: string
          cluster_id?: string | null
          created_at?: string | null
          id?: string
          pinecone_id: string
        }
        Update: {
          canonical_question?: string
          channel_id?: string
          cluster_id?: string | null
          created_at?: string | null
          id?: string
          pinecone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "question_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          channel_id: string | null
          created_at: string | null
          description: string | null
          id: string
          published_at: string | null
          thumbnail_url: string | null
          title: string | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string | null
          description?: string | null
          id: string
          published_at?: string | null
          thumbnail_url?: string | null
          title?: string | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          published_at?: string | null
          thumbnail_url?: string | null
          title?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
