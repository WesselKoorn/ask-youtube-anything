import { promises as fs } from "fs";
import path from "path";

import { ClipCandidate } from "@models/clip-candidate";

import { formatTimestamp } from "./util";

export interface ChannelProfile {
  source: string;
  videoCount: number;
  withTranscripts: number;
  failedCount: number;
  totalTranscriptSeconds: number;
}

export interface ReportInput {
  candidates: ClipCandidate[];
  questions: string[];
  profile: ChannelProfile;
  model: string;
  minConfidence: number;
  outDir: string;
}

export interface ReportResult {
  mdPath: string;
  jsonPath: string;
  answeredCount: number;
  totalQuestions: number;
}

export async function writeReport(input: ReportInput): Promise<ReportResult> {
  await fs.mkdir(input.outDir, { recursive: true });

  const grouped = groupByQuestion(input.candidates, input.questions);
  const answeredCount = grouped.filter((g) => g.clips.length > 0).length;
  const generatedAt = new Date().toISOString();

  const markdown = renderMarkdown(input, grouped, answeredCount, generatedAt);
  const json = JSON.stringify(
    {
      generatedAt,
      source: input.profile.source,
      model: input.model,
      minConfidence: input.minConfidence,
      profile: input.profile,
      coverage: { answered: answeredCount, total: input.questions.length },
      results: grouped,
    },
    null,
    2
  );

  const stamp = generatedAt.replace(/[:.]/g, "-");
  const mdPath = path.join(input.outDir, `clip-report-${stamp}.md`);
  const jsonPath = path.join(input.outDir, `clip-report-${stamp}.json`);

  await fs.writeFile(mdPath, markdown);
  await fs.writeFile(jsonPath, json);
  // Also keep stable "latest" copies for convenience.
  await fs.writeFile(path.join(input.outDir, "clip-report.md"), markdown);
  await fs.writeFile(path.join(input.outDir, "clip-report.json"), json);

  return {
    mdPath,
    jsonPath,
    answeredCount,
    totalQuestions: input.questions.length,
  };
}

interface QuestionGroup {
  question: string;
  clips: ClipCandidate[];
}

function groupByQuestion(
  candidates: ClipCandidate[],
  questions: string[]
): QuestionGroup[] {
  return questions.map((question) => ({
    question,
    clips: candidates
      .filter((c) => c.question === question)
      .sort((a, b) => b.confidence - a.confidence),
  }));
}

function renderMarkdown(
  input: ReportInput,
  grouped: QuestionGroup[],
  answeredCount: number,
  generatedAt: string
): string {
  const { profile, questions, model, minConfidence } = input;
  const minutes = Math.round(profile.totalTranscriptSeconds / 60);

  const lines: string[] = [];

  lines.push(`# SEO clip-finder report`);
  lines.push("");
  lines.push(`- **Source:** ${profile.source}`);
  lines.push(`- **Generated:** ${generatedAt}`);
  lines.push(`- **Model:** ${model}`);
  lines.push(`- **Min confidence:** ${minConfidence}`);
  lines.push("");
  lines.push(`## Coverage`);
  lines.push("");
  lines.push(
    `**${answeredCount} of ${questions.length} questions** have at least one clip ` +
      `at or above confidence ${minConfidence}.`
  );
  lines.push("");
  lines.push(`## Channel profile`);
  lines.push("");
  lines.push(`- Videos considered: ${profile.videoCount}`);
  lines.push(`- With usable transcripts: ${profile.withTranscripts}`);
  lines.push(`- Transcripts unavailable: ${profile.failedCount}`);
  lines.push(`- Transcript material: ~${minutes} min`);
  lines.push("");

  lines.push(`## Question coverage`);
  lines.push("");
  lines.push(`| Question | Clips | Best confidence |`);
  lines.push(`| --- | --- | --- |`);
  for (const group of grouped) {
    const best =
      group.clips.length > 0
        ? group.clips[0].confidence.toFixed(2)
        : "—";
    lines.push(
      `| ${escapePipes(group.question)} | ${group.clips.length} | ${best} |`
    );
  }
  lines.push("");

  lines.push(`## Clips by question`);
  lines.push("");
  for (const group of grouped) {
    lines.push(`### ${group.question}`);
    lines.push("");

    if (group.clips.length === 0) {
      lines.push(`_No confident answer found in the transcripts._`);
      lines.push("");
      continue;
    }

    for (const clip of group.clips) {
      lines.push(
        `- **${clip.clipTitle}** — confidence ${clip.confidence.toFixed(2)}`
      );
      lines.push(
        `  - ▶ [${formatTimestamp(clip.startTime)}–${formatTimestamp(
          clip.endTime
        )}](${clip.deepLink}) (${clip.durationSeconds}s) · "${clip.videoTitle}"`
      );
      if (clip.answerSummary) {
        lines.push(`  - ${clip.answerSummary}`);
      }
      lines.push(`  - > ${truncate(clip.transcriptText, 600)}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

function escapePipes(text: string): string {
  return text.replace(/\|/g, "\\|");
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}
