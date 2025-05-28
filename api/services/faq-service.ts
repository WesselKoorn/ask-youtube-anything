import { FAQQuestion } from "@models/faq-question";
import { FAQFilter } from "@models/faq-filter";
import { QuestionMetric } from "@models/question-metric";
import { createClient } from "@lib/supabase/server";

export class FAQService {
  /**
   * Get FAQs for a specific channel
   */
  static async getChannelFAQs(filter?: FAQFilter): Promise<FAQQuestion[]> {
    try {
      const supabase = await createClient();

      let query = supabase.from("questions").select(`
          id,
          canonical_question,
          cluster_id,
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

      // Transform and aggregate the data
      const faqQuestions = data.map((question) => ({
        id: question.id,
        canonicalQuestion: question.canonical_question,
        clusterId: question.cluster_id,
        frequency: question.question_metrics.reduce(
          (sum: number, metric: QuestionMetric) => sum + metric.frequency,
          0
        ),
        lastUpdated: new Date(
          Math.max(
            ...question.question_metrics.map((metric: QuestionMetric) =>
              new Date(metric.last_updated).getTime()
            )
          )
        ),
      }));

      // Apply search filter if provided
      if (filter?.searchQuery) {
        const searchLower = filter.searchQuery.toLowerCase();
        return faqQuestions.filter((question) =>
          question.canonicalQuestion.toLowerCase().includes(searchLower)
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
      const supabase = await createClient();

      const { data, error } = await supabase
        .from("questions")
        .select(
          `
          id,
          canonical_question,
          cluster_id,
          question_metrics!inner (
            frequency,
            last_updated
          )
        `
        )
        .eq("question_metrics.video_id", videoId);

      if (error) throw error;

      const faqQuestions = data.map((question) => ({
        id: question.id,
        canonicalQuestion: question.canonical_question,
        clusterId: question.cluster_id,
        videoId,
        frequency: question.question_metrics[0].frequency,
        lastUpdated: new Date(question.question_metrics[0].last_updated),
      }));

      // Apply additional filters
      let filtered = faqQuestions;

      if (filter?.startDate) {
        filtered = filtered.filter(
          (question) => question.lastUpdated >= filter.startDate!
        );
      }

      if (filter?.endDate) {
        filtered = filtered.filter(
          (question) => question.lastUpdated <= filter.endDate!
        );
      }

      if (filter?.minFrequency) {
        filtered = filtered.filter(
          (question) => question.frequency >= filter.minFrequency!
        );
      }

      if (filter?.searchQuery) {
        const searchLower = filter.searchQuery.toLowerCase();
        filtered = filtered.filter((question) =>
          question.canonicalQuestion.toLowerCase().includes(searchLower)
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
      const supabase = await createClient();

      // Get the main question
      const { data: questionData, error: questionError } = await supabase
        .from("questions")
        .select(
          `
          id,
          canonical_question,
          cluster_id,
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

      const question: FAQQuestion = {
        id: questionData.id,
        canonicalQuestion: questionData.canonical_question,
        clusterId: questionData.cluster_id,
        frequency: questionData.question_metrics.reduce(
          (sum: number, metric: QuestionMetric) => sum + metric.frequency,
          0
        ),
        lastUpdated: new Date(
          Math.max(
            ...questionData.question_metrics.map((metric: QuestionMetric) =>
              new Date(metric.last_updated).getTime()
            )
          )
        ),
      };

      // Get related questions from the same cluster
      const { data: relatedData, error: relatedError } = await supabase
        .from("questions")
        .select(
          `
          id,
          canonical_question,
          cluster_id,
          question_metrics (
            video_id,
            frequency,
            last_updated
          )
        `
        )
        .eq("cluster_id", question.clusterId)
        .neq("id", questionId);

      if (relatedError) throw relatedError;

      const relatedQuestions: FAQQuestion[] = relatedData.map((question) => ({
        id: question.id,
        canonicalQuestion: question.canonical_question,
        clusterId: question.cluster_id,
        frequency: question.question_metrics.reduce(
          (sum: number, metric: QuestionMetric) => sum + metric.frequency,
          0
        ),
        lastUpdated: new Date(
          Math.max(
            ...question.question_metrics.map((metric: QuestionMetric) =>
              new Date(metric.last_updated).getTime()
            )
          )
        ),
      }));

      return { question, relatedQuestions };
    } catch (error) {
      console.error("Error getting question details:", error);
      throw error;
    }
  }
}
