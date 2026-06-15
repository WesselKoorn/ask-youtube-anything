import { TranscriptCue } from "@models/transcript";

/** Rough token estimate (~4 chars/token). Good enough for batch sizing. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Format seconds as `m:ss` (or `h:mm:ss` past an hour). */
export function formatTimestamp(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");

  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Build a YouTube deep link that jumps to a given start time. */
export function buildDeepLink(videoId: string, startSeconds: number): string {
  const t = Math.max(0, Math.floor(startSeconds));

  return `https://www.youtube.com/watch?v=${videoId}&t=${t}s`;
}

/** End time (seconds) of the last cue — i.e. the video's transcript length. */
export function transcriptDuration(cues: TranscriptCue[]): number {
  if (cues.length === 0) return 0;
  const last = cues[cues.length - 1];

  return last.start + last.duration;
}

/**
 * Reconstruct the spoken text between two timestamps from the original cues.
 * We rebuild it ourselves rather than trust the model to quote verbatim.
 */
export function cuesToText(
  cues: TranscriptCue[],
  startSeconds: number,
  endSeconds: number
): string {
  const text = cues
    .filter((cue) => cue.start + cue.duration >= startSeconds && cue.start <= endSeconds)
    .map((cue) => cue.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

/** Run an async mapper over items with a fixed concurrency limit. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);

  return results;
}
