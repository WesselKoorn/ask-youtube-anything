import "dotenv/config";

import { promises as fs } from "fs";

import { parseArgs } from "./lib/args";
import { findClips } from "./lib/matcher";
import { ChannelProfile, writeReport } from "./lib/report";
import { loadTranscripts, resolveVideos } from "./lib/transcripts";
import { transcriptDuration } from "./lib/util";

async function loadQuestions(file: string): Promise<string[]> {
  const raw = await fs.readFile(file, "utf8");

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

async function main(): Promise<void> {
  const config = parseArgs(process.argv.slice(2));
  if (!config) return; // --help was printed

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set. Add it to a .env file.");
  }

  const questions = await loadQuestions(config.questionsFile);
  if (questions.length === 0) {
    throw new Error(`No questions found in ${config.questionsFile}`);
  }
  console.log(`Loaded ${questions.length} question(s) from ${config.questionsFile}`);

  console.log("Resolving videos...");
  const videos = await resolveVideos(config);
  console.log(`Found ${videos.length} video(s).`);

  console.log("Fetching transcripts (cached where possible)...");
  const { transcripts, cachedCount, fetchedCount, failedVideoIds } =
    await loadTranscripts(videos, config);
  console.log(
    `Transcripts: ${transcripts.length} usable ` +
      `(${cachedCount} cached, ${fetchedCount} fetched, ${failedVideoIds.length} unavailable).`
  );

  if (transcripts.length === 0) {
    throw new Error(
      "No transcripts could be retrieved. The videos may have captions disabled, " +
        "or YouTube may be rate-limiting transcript requests — try again or use --videos."
    );
  }

  const candidates = await findClips(transcripts, questions, {
    model: config.model,
    minConfidence: config.minConfidence,
    tokenBudget: config.tokenBudget,
    log: (message) => console.log(message),
  });

  const profile: ChannelProfile = {
    source: config.channelUrl ?? config.videosFile ?? "unknown",
    videoCount: videos.length,
    withTranscripts: transcripts.length,
    failedCount: failedVideoIds.length,
    totalTranscriptSeconds: transcripts.reduce(
      (sum, t) => sum + transcriptDuration(t.cues),
      0
    ),
  };

  const result = await writeReport({
    candidates,
    questions,
    profile,
    model: config.model,
    minConfidence: config.minConfidence,
    outDir: config.outDir,
  });

  console.log("");
  console.log(
    `Done: ${result.answeredCount}/${result.totalQuestions} questions have a clip ` +
      `(confidence ≥ ${config.minConfidence}), ${candidates.length} clip(s) total.`
  );
  console.log(`Report:  ${result.mdPath}`);
  console.log(`JSON:    ${result.jsonPath}`);
}

main().catch((error) => {
  console.error(`\nError: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
