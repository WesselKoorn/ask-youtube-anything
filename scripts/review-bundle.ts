import { promises as fs } from "fs";

interface Cue { start: number; duration: number; text: string }
interface Clip {
  question: string; videoId: string; videoTitle: string;
  startTime: number; endTime: number; confidence: number; answerSummary: string;
}
interface Report { results: { question: string; clips: Clip[] }[] }

function mmss(s: number) {
  const x = Math.max(0, Math.floor(s));
  return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, "0")}`;
}

async function loadCues(id: string): Promise<Cue[]> {
  try {
    return JSON.parse(await fs.readFile(`data/transcripts/${id}.json`, "utf8")).cues || [];
  } catch {
    return [];
  }
}

function parseCats(text: string) {
  const cats: { cat: string; qs: string[] }[] = [];
  let cur: { cat: string; qs: string[] } | null = null;
  for (const raw of text.split("\n")) {
    const s = raw.trim();
    if (!s) continue;
    if (s.startsWith("## ")) { cur = { cat: s.slice(3), qs: [] }; cats.push(cur); }
    else if (s.startsWith("#")) continue;
    else { if (!cur) { cur = { cat: "Q", qs: [] }; cats.push(cur); } cur.qs.push(s); }
  }
  return cats;
}

async function main() {
  const report: Report = JSON.parse(await fs.readFile("data/reports/clip-report.json", "utf8"));
  const byQ = new Map(report.results.map((g) => [g.question, g.clips]));
  const cats = parseCats(await fs.readFile("questions.txt", "utf8"));
  const cueCache = new Map<string, Cue[]>();
  const out: string[] = [];

  for (const { cat, qs } of cats) {
    if (!qs.some((q) => (byQ.get(q) || []).length > 0)) continue;
    out.push(`\n========== CATEGORY: ${cat} ==========`);
    for (const q of qs) {
      const clips = byQ.get(q) || [];
      if (!clips.length) continue;
      out.push(`\n#### Q: ${q}`);
      for (const c of clips.slice(0, 2)) {
        if (!cueCache.has(c.videoId)) cueCache.set(c.videoId, await loadCues(c.videoId));
        const cues = cueCache.get(c.videoId)!;
        out.push(
          `-- CAND ${c.videoId} | ${c.videoTitle} | gpt ${Math.round(c.confidence * 100)}% | win ${mmss(c.startTime)}–${mmss(c.endTime)} (${c.startTime.toFixed(0)}–${c.endTime.toFixed(0)}s)`
        );
        out.push(`   gpt-summary: ${c.answerSummary}`);
        const lo = c.startTime - 12;
        const hi = c.endTime + 12;
        for (const cue of cues) {
          if (cue.start >= lo && cue.start <= hi) {
            const mark =
              cue.start >= c.startTime && cue.start < c.startTime + 1.5 ? ">"
              : cue.start >= c.endTime - 1.5 && cue.start < c.endTime + 0.5 ? "<"
              : " ";
            out.push(`   ${mark} ${cue.start.toFixed(1).padStart(7)}  ${cue.text}`);
          }
        }
      }
    }
  }

  await fs.writeFile("data/reports/_review.txt", out.join("\n"));
  console.log(`wrote data/reports/_review.txt (${out.length} lines)`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
