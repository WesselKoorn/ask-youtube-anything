import { promises as fs } from "fs";

interface Cue { start: number; duration: number; text: string }
interface Decision { videoId: string; start: number; end: number; confidence: number; summary: string }

function cuesToText(cues: Cue[], start: number, end: number): string {
  return cues
    .filter((c) => c.start + c.duration >= start && c.start <= end)
    .map((c) => c.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
function deepLink(id: string, start: number): string {
  return `https://www.youtube.com/watch?v=${id}&t=${Math.max(0, Math.floor(start))}s`;
}

async function main() {
  const decisions: Record<string, Decision> = JSON.parse(
    await fs.readFile("verify-decisions.json", "utf8")
  );
  const prev = JSON.parse(await fs.readFile("data/reports/clip-report.json", "utf8"));

  const questions = (await fs.readFile("questions.txt", "utf8"))
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  const cueCache: Record<string, Cue[]> = {};
  const titleCache: Record<string, string> = {};
  async function load(id: string): Promise<Cue[]> {
    if (!cueCache[id]) {
      const d = JSON.parse(await fs.readFile(`data/transcripts/${id}.json`, "utf8"));
      cueCache[id] = d.cues || [];
      titleCache[id] = d.title || id;
    }
    return cueCache[id];
  }

  const results = [];
  for (const q of questions) {
    const dec = decisions[q];
    if (!dec) {
      results.push({ question: q, clips: [] });
      continue;
    }
    const cues = await load(dec.videoId);
    results.push({
      question: q,
      clips: [
        {
          question: q,
          videoId: dec.videoId,
          videoTitle: titleCache[dec.videoId],
          startTime: dec.start,
          endTime: dec.end,
          durationSeconds: Math.round(dec.end - dec.start),
          confidence: dec.confidence,
          clipTitle: q,
          answerSummary: dec.summary,
          transcriptText: cuesToText(cues, dec.start, dec.end),
          deepLink: deepLink(dec.videoId, dec.start),
        },
      ],
    });
  }

  const answered = results.filter((r) => r.clips.length > 0).length;
  const out = {
    generatedAt: new Date().toISOString(),
    source: prev.source,
    model: "gpt-5.5 recall + Opus 4.8 verification",
    minConfidence: 0.5,
    profile: prev.profile,
    coverage: { answered, total: questions.length },
    results,
  };
  await fs.writeFile("data/reports/clip-report.json", JSON.stringify(out, null, 2));
  console.log(`Applied ${Object.keys(decisions).length} verified matches → answered ${answered}/${questions.length}.`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
