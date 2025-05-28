import { FAQService } from "./services/faq-service";
import { FAQFilter } from "@models/faq-filter";

export async function getChannelFAQs(filter?: FAQFilter) {
  return FAQService.getChannelFAQs(filter);
}

export async function getVideoFAQs(
  videoId: string,
  filter?: Omit<FAQFilter, "videoId">
) {
  if (!videoId) {
    throw new Error("Video ID is required");
  }

  return FAQService.getVideoFAQs(videoId, filter);
}

export async function getQuestionDetails(questionId: string) {
  if (!questionId) {
    throw new Error("Question ID is required");
  }

  return FAQService.getQuestionDetails(questionId);
}
