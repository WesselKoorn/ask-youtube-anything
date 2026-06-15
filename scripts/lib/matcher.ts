import { ClipCandidate } from "@models/clip-candidate";
import { TranscriptCue, VideoTranscript } from "@models/transcript";

import { chatJson } from "./llm";
import {
  buildDeepLink,
  cuesToText,
  estimateTokens,
  transcriptDuration,
} from "./util";

/** The LLM call seam — injectable so the matcher can be tested offline. */
export type ChatJsonFn = <T>(opts: {
  system: string;
  user: string;
  model: string;
}) => Promise<T>;

/** Hard cap on clip length, as a guard against runaway model output. */
const MAX_CLIP_SECONDS = 180;
/** Fallback clip length when the model gives an end <= start. */
const FALLBACK_CLIP_SECONDS = 30;

interface BatchItem {
  videoId: string;
  title: string;
  cues: TranscriptCue[];
}

interface RawMatch {
  questionIndex: number;
  videoId: string;
  startSeconds: number;
  endSeconds: number;
  confidence: number;
  clipTitle?: string;
  answerSummary?: string;
}

interface MatchResponse {
  matches?: RawMatch[];
}

const SYSTEM_PROMPT = `
You are an expert short-form video editor and SEO analyst. You are given
transcripts of a channel's videos (each line prefixed with its start time in
seconds) and a list of SEO questions. You find the exact moments where a
question is directly and substantively answered out loud, so the moment can be
cut into a short clip. You only report genuine, self-contained answers — never
passing mentions, intros, or questions that are raised but left unanswered.
You respond with JSON only.
`.trim();

/**
 * Find answer-moment clip candidates for every question across all transcripts.
 * Strategy: pack transcripts into token-budgeted batches, ask the model to
 * locate answers within each batch (map), then merge/dedupe/rank (reduce).
 */
export async function findClips(
  transcripts: VideoTranscript[],
  questions: string[],
  options: {
    model: string;
    minConfidence: number;
    tokenBudget: number;
    log?: (message: string) => void;
    chat?: ChatJsonFn;
  }
): Promise<ClipCandidate[]> {
  const log = options.log ?? (() => {});
  const chat = options.chat ?? chatJson;
  const byVideoId = new Map(transcripts.map((t) => [t.videoId, t]));

  const items: BatchItem[] = transcripts.map((t) => ({
    videoId: t.videoId,
    title: t.title,
    cues: t.cues,
  }));
  const batches = buildBatches(items, options.tokenBudget);

  log(`Matching across ${batches.length} model call(s)...`);

  const candidates: ClipCandidate[] = [];
  for (let i = 0; i < batches.length; i++) {
    log(`  batch ${i + 1}/${batches.length}`);
    const response = await runBatch(batches[i], questions, options.model, chat);

    for (const raw of response.matches ?? []) {
      const candidate = toCandidate(raw, questions, byVideoId);
      if (candidate) candidates.push(candidate);
    }
  }

  const filtered = candidates.filter(
    (c) => c.confidence >= options.minConfidence
  );

  return dedupe(filtered);
}

async function runBatch(
  batch: BatchItem[],
  questions: string[],
  model: string,
  chat: ChatJsonFn
): Promise<MatchResponse> {
  const questionBlock = questions
    .map((q, i) => `${i + 1}. ${q}`)
    .join("\n");
  const transcriptBlock = batch.map(formatItem).join("\n\n");

  const user = `
QUESTIONS:
${questionBlock}

TRANSCRIPTS:
${transcriptBlock}

TASK:
For each question, find every moment in the TRANSCRIPTS above where it is
clearly and substantively answered. For each match, return:
- questionIndex: the 1-based number of the question
- videoId: the VIDEO id the moment comes from (must be one shown above)
- startSeconds / endSeconds: the answer's boundaries in seconds, taken from the
  bracketed timestamps; aim for a self-contained 15-75s clip that starts and
  ends on a complete thought
- confidence: 0-1, how directly and completely the moment answers the question
- clipTitle: a punchy, SEO-friendly title for the clip
- answerSummary: one sentence summarizing the answer

Omit any question that is not answered in these transcripts. Returning nothing
is better than returning a weak or speculative match.

Respond with JSON of exactly this shape:
{ "matches": [ { "questionIndex": 1, "videoId": "abc123", "startSeconds": 12.3, "endSeconds": 48.0, "confidence": 0.82, "clipTitle": "...", "answerSummary": "..." } ] }
`.trim();

  try {
    return await chat<MatchResponse>({ system: SYSTEM_PROMPT, user, model });
  } catch (error) {
    // A single bad batch shouldn't sink the whole run.
    console.error(`  (batch failed: ${(error as Error).message})`);
    return { matches: [] };
  }
}

function formatItem(item: BatchItem): string {
  const lines = item.cues
    .map((cue) => `[${cue.start.toFixed(1)}] ${cue.text}`)
    .join("\n");

  return `### VIDEO ${item.videoId} | ${item.title}\n${lines}`;
}

function toCandidate(
  raw: RawMatch,
  questions: string[],
  byVideoId: Map<string, VideoTranscript>
): ClipCandidate | null {
  const index = Number(raw.questionIndex);
  if (!Number.isInteger(index) || index < 1 || index > questions.length) {
    return null;
  }

  const transcript = byVideoId.get(raw.videoId);
  if (!transcript) return null; // model referenced a video not in this batch

  const videoEnd = transcriptDuration(transcript.cues);
  let start = Math.max(0, Number(raw.startSeconds) || 0);
  let end = Number(raw.endSeconds) || 0;

  if (end <= start) end = start + FALLBACK_CLIP_SECONDS;
  end = Math.min(end, start + MAX_CLIP_SECONDS, videoEnd || end);
  start = Math.min(start, Math.max(0, end - 1));

  const confidence = Math.max(0, Math.min(1, Number(raw.confidence) || 0));

  return {
    question: questions[index - 1],
    videoId: raw.videoId,
    videoTitle: transcript.title,
    startTime: start,
    endTime: end,
    durationSeconds: Math.round(end - start),
    confidence,
    clipTitle: (raw.clipTitle ?? "").trim() || questions[index - 1],
    answerSummary: (raw.answerSummary ?? "").trim(),
    transcriptText: cuesToText(transcript.cues, start, end),
    deepLink: buildDeepLink(raw.videoId, start),
  };
}

/** Drop near-duplicate clips (same question + video + overlapping span). */
function dedupe(candidates: ClipCandidate[]): ClipCandidate[] {
  const kept: ClipCandidate[] = [];
  const byConfidence = [...candidates].sort(
    (a, b) => b.confidence - a.confidence
  );

  for (const candidate of byConfidence) {
    const isDuplicate = kept.some(
      (k) =>
        k.question === candidate.question &&
        k.videoId === candidate.videoId &&
        k.startTime < candidate.endTime &&
        candidate.startTime < k.endTime
    );
    if (!isDuplicate) kept.push(candidate);
  }

  return kept;
}

function buildBatches(
  items: BatchItem[],
  tokenBudget: number
): BatchItem[][] {
  const batches: BatchItem[][] = [];
  let current: BatchItem[] = [];
  let currentTokens = 0;

  const flush = () => {
    if (current.length) {
      batches.push(current);
      current = [];
      currentTokens = 0;
    }
  };

  for (const item of items) {
    const itemTokens = estimateTokens(formatItem(item));

    if (itemTokens > tokenBudget) {
      // A single video bigger than the budget: split it into windows.
      flush();
      for (const window of splitItem(item, tokenBudget)) batches.push([window]);
      continue;
    }

    if (currentTokens + itemTokens > tokenBudget) flush();
    current.push(item);
    currentTokens += itemTokens;
  }

  flush();
  return batches;
}

function splitItem(item: BatchItem, tokenBudget: number): BatchItem[] {
  const windows: BatchItem[] = [];
  let cues: TranscriptCue[] = [];
  let tokens = 0;

  for (const cue of item.cues) {
    const cueTokens = estimateTokens(cue.text) + 8; // + timestamp overhead
    if (tokens + cueTokens > tokenBudget && cues.length) {
      windows.push({ ...item, cues });
      cues = [];
      tokens = 0;
    }
    cues.push(cue);
    tokens += cueTokens;
  }

  if (cues.length) windows.push({ ...item, cues });
  return windows;
}
