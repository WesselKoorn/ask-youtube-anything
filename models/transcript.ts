/**
 * A single timestamped line of a video transcript.
 *
 * The timestamps are the whole point: they are what let us deep-link to,
 * and later clip, the exact moment an answer is spoken.
 */
export interface TranscriptCue {
  /** Start time of the cue, in seconds from the beginning of the video. */
  start: number;
  /** Duration of the cue, in seconds. */
  duration: number;
  /** The spoken text of the cue. */
  text: string;
}

/**
 * A full video transcript with its timestamped cues plus enough metadata to
 * build links and a readable report.
 */
export interface VideoTranscript {
  videoId: string;
  title: string;
  channelId: string;
  publishedAt: string;
  cues: TranscriptCue[];
}
