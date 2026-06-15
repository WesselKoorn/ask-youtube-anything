/**
 * A candidate short clip: a moment in a video where an SEO question is
 * answered, located precisely enough to deep-link to and (later) cut.
 */
export interface ClipCandidate {
  /** The SEO question this clip answers. */
  question: string;
  videoId: string;
  videoTitle: string;
  /** Start of the answer, in seconds. */
  startTime: number;
  /** End of the answer, in seconds. */
  endTime: number;
  /** Length of the clip, in seconds (endTime - startTime). */
  durationSeconds: number;
  /** Model confidence that the question is genuinely answered (0-1). */
  confidence: number;
  /** Suggested SEO / Short title for the clip. */
  clipTitle: string;
  /** One-sentence summary of the answer. */
  answerSummary: string;
  /** The transcript text covering the answer span, reconstructed from cues. */
  transcriptText: string;
  /** Deep link into the source video at the answer's start. */
  deepLink: string;
}
