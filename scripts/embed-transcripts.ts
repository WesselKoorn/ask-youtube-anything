import "dotenv/config";

import { promises as fs } from "fs";
import path from "path";

import { embedTexts } from "./lib/embeddings";

/**
 * Build the retrieval index: chunk every cached transcript into short
 * overlapping windows (each carrying its exact start/end), embed them, and save
 * data/index/chunks.json. This is the recall layer — semantic search over these
 * chunks finds candidate clips precisely, instead of an LLM scanning everything.
 */

interface Cue { start: number; duration: number; text: string }
interface Chunk {
  id: string;
  videoId: string;
  videoTitle: string;
  start: number;
  end: number;
  text: string;
  embedding: number[];
}

const WINDOW_SEC = 32;
const OVERLAP_SEC = 12;

function chunkByCues(
  videoId: string,
  videoTitle: string,
  cues: Cue[]
): Omit<Chunk, "embedding">[] {
  const chunks: Omit<Chunk, "embedding">[] = [];
  let i = 0;
  let idx = 0;
  while (i < cues.length) {
    const startT = cues[i].start;
    let j = i;
    while (j < cues.length && cues[j].start + (cues[j].duration || 0) - startT < WINDOW_SEC) j++;
    const slice = cues.slice(i, Math.max(j, i + 1));
    const text = slice.map((c) => c.text).join(" ").replace(/\s+/g, " ").trim();
    const last = slice[slice.length - 1];
    if (text.length > 40) {
      chunks.push({
        id: `${videoId}_${idx++}`,
        videoId,
        videoTitle,
        start: +slice[0].start.toFixed(1),
        end: +(last.start + (last.duration || 0)).toFixed(1),
        text,
      });
    }
    const advanceTarget = startT + (WINDOW_SEC - OVERLAP_SEC);
    let k = i + 1;
    while (k < cues.length && cues[k].start < advanceTarget) k++;
    i = Math.max(k, i + 1);
  }
  return chunks;
}

async function main(): Promise<void> {
  const dir = "data/transcripts";
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
  const raw: Omit<Chunk, "embedding">[] = [];
  for (const f of files) {
    const d = JSON.parse(await fs.readFile(path.join(dir, f), "utf8"));
    raw.push(...chunkByCues(d.videoId, d.title || d.videoId, d.cues || []));
  }
  console.log(`Chunked ${files.length} transcripts → ${raw.length} chunks. Embedding…`);

  const embeddings = await embedTexts(raw.map((c) => c.text));
  const chunks: Chunk[] = raw.map((c, i) => ({ ...c, embedding: embeddings[i] }));

  await fs.mkdir("data/index", { recursive: true });
  await fs.writeFile("data/index/chunks.json", JSON.stringify(chunks));
  console.log(
    `Wrote data/index/chunks.json (${chunks.length} chunks, dim ${embeddings[0]?.length}).`
  );
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
