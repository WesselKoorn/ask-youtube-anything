import { Database } from '@supabase/database.types';
import { createAdminClient } from "@lib/supabase/server";
import { FAQQuestion } from "@models/faq-question";

type FAQFilter = {
  videoId?: string;
  startDate?: Date;
  endDate?: Date;
  minFrequency?: number;
  searchQuery?: string;
};

type QuestionWithMetrics = Database['public']['Tables']['questions']['Row'] & {
  question_metrics: Database['public']['Tables']['question_metrics']['Row'][];
};

export class FAQService {
  /**
   * Get FAQs for a specific channel
   */
  static async getChannelFAQs(filter?: FAQFilter): Promise<FAQQuestion[]> {
    try {
      const supabase = await createAdminClient();

      let query = supabase.from("questions").select(`
          id,
          canonical_question,
          cluster_id,
          channel_id,
          created_at,
          pinecone_id,
          question_metrics (
            video_id,
            frequency,
            last_updated
          )
        `);

      if (filter?.videoId) {
        query = query.eq("question_metrics.video_id", filter.videoId);
      }

      if (filter?.startDate) {
        query = query.gte(
          "question_metrics.last_updated",
          filter.startDate.toISOString()
        );
      }

      if (filter?.endDate) {
        query = query.lte(
          "question_metrics.last_updated",
          filter.endDate.toISOString()
        );
      }

      if (filter?.minFrequency) {
        query = query.gte("question_metrics.frequency", filter.minFrequency);
      }

      const { data, error } = await query;

      if (error) throw error;

      console.log("FAQ data:", data);

      // Transform and aggregate the data
      const faqQuestions = (data as QuestionWithMetrics[]).map((question) => {
        const totalFrequency = question.question_metrics.reduce(
          (sum, metric) => sum + (metric.frequency || 0),
          0
        );
        const lastUpdated = question.question_metrics.reduce(
          (latest, metric) => {
            const metricDate = new Date(metric.last_updated || '');
            return metricDate > latest ? metricDate : latest;
          },
          new Date(0)
        );

        return {
          ...question,
          frequency: totalFrequency,
          lastUpdated: lastUpdated.toISOString()
        };
      });

      // Apply search filter if provided
      if (filter?.searchQuery) {
        const searchLower = filter.searchQuery.toLowerCase();
        return faqQuestions.filter((question) =>
          question.canonical_question.toLowerCase().includes(searchLower)
        );
      }

      return faqQuestions;
    } catch (error) {
      console.error("Error getting channel FAQs:", error);
      throw error;
    }
  }

  /**
   * Get FAQs for a specific video
   */
  static async getVideoFAQs(
    videoId: string,
    filter?: Omit<FAQFilter, "videoId">
  ): Promise<FAQQuestion[]> {
    try {
      const supabase = await createAdminClient();

      const { data, error } = await supabase
        .from("questions")
        .select(
          `
          id,
          canonical_question,
          cluster_id,
          channel_id,
          created_at,
          pinecone_id,
          question_metrics!inner (
            frequency,
            last_updated
          )
        `
        )
        .eq("question_metrics.video_id", videoId);

      if (error) throw error;

      const faqQuestions = (data as QuestionWithMetrics[]).map((question) => {
        const totalFrequency = question.question_metrics.reduce(
          (sum, metric) => sum + (metric.frequency || 0),
          0
        );
        const lastUpdated = question.question_metrics.reduce(
          (latest, metric) => {
            const metricDate = new Date(metric.last_updated || '');
            return metricDate > latest ? metricDate : latest;
          },
          new Date(0)
        );

        return {
          ...question,
          frequency: totalFrequency,
          lastUpdated: lastUpdated.toISOString()
        };
      });

      // Apply additional filters
      let filtered = faqQuestions;

      if (filter?.searchQuery) {
        const searchLower = filter.searchQuery.toLowerCase();
        filtered = filtered.filter((question) =>
          question.canonical_question.toLowerCase().includes(searchLower)
        );
      }

      return filtered;
    } catch (error) {
      console.error("Error getting video FAQs:", error);
      throw error;
    }
  }

  /**
   * Get detailed information about a specific question
   */
  static async getQuestionDetails(questionId: string): Promise<{
    question: FAQQuestion;
    relatedQuestions: FAQQuestion[];
  }> {
    try {
      const supabase = await createAdminClient();

      // Get the main question
      const { data: questionData, error: questionError } = await supabase
        .from("questions")
        .select(
          `
          id,
          canonical_question,
          cluster_id,
          channel_id,
          created_at,
          pinecone_id,
          question_metrics (
            video_id,
            frequency,
            last_updated
          )
        `
        )
        .eq("id", questionId)
        .single();

      if (questionError) throw questionError;

      const totalFrequency = questionData.question_metrics.reduce(
        (sum, metric) => sum + (metric.frequency || 0),
        0
      );
      const lastUpdated = questionData.question_metrics.reduce(
        (latest, metric) => {
          const metricDate = new Date(metric.last_updated || '');
          return metricDate > latest ? metricDate : latest;
        },
        new Date(0)
      );

      const question: FAQQuestion = {
        ...questionData,
        frequency: totalFrequency,
        lastUpdated: lastUpdated.toISOString()
      };

      // Get related questions from the same cluster
      const { data: relatedData, error: relatedError } = await supabase
        .from("questions")
        .select(
          `
          id,
          canonical_question,
          cluster_id,
          channel_id,
          created_at,
          pinecone_id,
          question_metrics (
            video_id,
            frequency,
            last_updated
          )
        `
        )
        .eq("cluster_id", question.cluster_id ?? '')
        .neq("id", questionId);

      if (relatedError) throw relatedError;

      const relatedQuestions: FAQQuestion[] = (relatedData as QuestionWithMetrics[]).map((question) => {
        const totalFrequency = question.question_metrics.reduce(
          (sum, metric) => sum + (metric.frequency || 0),
          0
        );
        const lastUpdated = question.question_metrics.reduce(
          (latest, metric) => {
            const metricDate = new Date(metric.last_updated || '');
            return metricDate > latest ? metricDate : latest;
          },
          new Date(0)
        );

        return {
          ...question,
          frequency: totalFrequency,
          lastUpdated: lastUpdated.toISOString()
        };
      });

      return { question, relatedQuestions };
    } catch (error) {
      console.error("Error getting question details:", error);
      throw error;
    }
  }

  static async getTopQuestions(channelId: string): Promise<Database['public']['Tables']['question_clusters']['Row'][]> {
    const supabase = await createAdminClient();
    const { data: clusters, error } = await supabase
      .from("question_clusters")
      .select("*")
      .eq("channel_id", channelId)
      .order("name", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Error fetching top questions:", error);
      throw error;
    }

    return clusters;
  }

  static async recordQuestionMetric(
    questionId: string,
    videoId: string,
    channelId: string
  ): Promise<void> {
    const supabase = await createAdminClient();
    const questionMetric: Database['public']['Tables']['question_metrics']['Insert'] = {
      question_id: questionId,
      video_id: videoId,
      channel_id: channelId,
      frequency: 1,
      last_updated: new Date().toISOString()
    };

    const { error } = await supabase.from("question_metrics").insert(questionMetric);

    if (error) {
      console.error("Error recording question metric:", error);
      throw error;
    }
  }
}
