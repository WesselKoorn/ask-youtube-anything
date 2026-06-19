import "dotenv/config";

import { promises as fs } from "fs";

import { cosine, embedTexts } from "./lib/embeddings";

/**
 * Full-blog retrieval: for every article URL (data/blog/urls.txt), build a
 * topical query from its slug, embed it, and pull the most similar transcript
 * chunks. Output is sorted by best similarity so the plausible matches float to
 * the top for verification; the long low-similarity tail is the "no strong
 * clip" set.
 */

interface Chunk {
  videoId: string;
  videoTitle: string;
  start: number;
  end: number;
  text: string;
  embedding: number[];
}

const TOP_K = 6;

function mmss(s: number): string {
  const x = Math.max(0, Math.floor(s));
  return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, "0")}`;
}

async function main(): Promise<void> {
  const chunks: Chunk[] = JSON.parse(await fs.readFile("data/index/chunks.json", "utf8"));
  const urls = (await fs.readFile("data/blog/urls.txt", "utf8"))
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const articles = urls.map((url) => {
    const slug = url.replace(/\/+$/, "").split("/").pop() || url;
    return { url, slug, query: slug.replace(/-/g, " ") };
  });

  const emb = await embedTexts(articles.map((a) => a.query));

  const rows = articles
    .map((a, i) => {
      const scored = chunks
        .map((c) => ({ c, score: cosine(emb[i], c.embedding) }))
        .sort((x, y) => y.score - x.score)
        .slice(0, TOP_K);
      return { ...a, bestSim: scored[0].score, candidates: scored };
    })
    .sort((x, y) => y.bestSim - x.bestSim);

  const lines: string[] = [];
  for (const r of rows) {
    lines.push(`[${r.bestSim.toFixed(3)}] ${r.slug}`);
    for (const { c, score } of r.candidates.slice(0, 3)) {
      lines.push(
        `    ${score.toFixed(3)} ${c.videoId}@${mmss(c.start)} ${c.videoTitle.slice(0, 26)} :: ${c.text.slice(0, 105).replace(/\s+/g, " ")}`
      );
    }
  }
  await fs.writeFile("data/blog/_match.txt", lines.join("\n"));
  await fs.writeFile(
    "data/blog/_match.json",
    JSON.stringify(
      rows.map((r) => ({
        slug: r.slug,
        url: r.url,
        bestSim: r.bestSim,
        candidates: r.candidates.map(({ c, score }) => ({
          videoId: c.videoId,
          videoTitle: c.videoTitle,
          start: c.start,
          end: c.end,
          text: c.text,
          score,
        })),
      })),
      null,
      2
    )
  );
  console.log(
    `Matched ${rows.length} articles. bestSim range ${rows[rows.length - 1].bestSim.toFixed(2)}–${rows[0].bestSim.toFixed(2)}.`
  );
  const buckets = [0.55, 0.5, 0.45, 0.4].map(
    (t) => `≥${t}: ${rows.filter((r) => r.bestSim >= t).length}`
  );
  console.log(`Articles by best similarity → ${buckets.join("  ")}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
