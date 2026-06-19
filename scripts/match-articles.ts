import "dotenv/config";

import { promises as fs } from "fs";
import path from "path";

import { cosine, embedTexts } from "./lib/embeddings";

/**
 * Retrieval step for blog → clip matching. Embeds each scraped article and
 * pulls the most semantically-similar transcript chunks from the index. The
 * output is a candidate bundle — a human/Opus then verifies which clip actually
 * illustrates the article and tightens the window.
 */

interface Chunk {
  id: string;
  videoId: string;
  videoTitle: string;
  start: number;
  end: number;
  text: string;
  embedding: number[];
}
interface Article { slug: string; url: string; title: string; text: string }

const TOP_K = 10;

function mmss(s: number): string {
  const x = Math.max(0, Math.floor(s));
  return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, "0")}`;
}

async function main(): Promise<void> {
  const chunks: Chunk[] = JSON.parse(await fs.readFile("data/index/chunks.json", "utf8"));
  const blogDir = "data/blog";
  const files = (await fs.readdir(blogDir)).filter((f) => f.endsWith(".md"));
  const articles: Article[] = [];
  for (const f of files) {
    const raw = await fs.readFile(path.join(blogDir, f), "utf8");
    const lines = raw.split("\n");
    const slug = f.replace(/\.md$/, "");
    articles.push({
      slug,
      url: `https://www.truedialog.com/resources/blog/${slug}/`,
      title: (lines[0] || "").replace(/^#+\s*/, "").trim(),
      text: lines.slice(1).join("\n").trim(),
    });
  }

  const artEmb = await embedTexts(
    articles.map((a) => `${a.title}\n\n${a.text}`.slice(0, 8000))
  );

  const lines: string[] = [];
  const bundle: unknown[] = [];
  articles.forEach((a, ai) => {
    const scored = chunks
      .map((c) => ({ c, score: cosine(artEmb[ai], c.embedding) }))
      .sort((x, y) => y.score - x.score)
      .slice(0, TOP_K);

    lines.push(`\n========== ARTICLE: ${a.title}`);
    lines.push(`URL: ${a.url}`);
    lines.push(`ABOUT: ${a.text.slice(0, 320).replace(/\s+/g, " ")}…`);
    lines.push(`--- top ${TOP_K} candidate clips (semantic similarity) ---`);
    scored.forEach(({ c, score }, i) => {
      lines.push(
        `[${i + 1}] sim=${score.toFixed(3)} | ${c.videoId} ${mmss(c.start)}-${mmss(c.end)} | ${c.videoTitle}`
      );
      lines.push(`    ${c.text.slice(0, 320).replace(/\s+/g, " ")}`);
    });
    bundle.push({
      slug: a.slug,
      title: a.title,
      url: a.url,
      candidates: scored.map(({ c, score }) => ({
        videoId: c.videoId,
        videoTitle: c.videoTitle,
        start: c.start,
        end: c.end,
        text: c.text,
        score,
      })),
    });
  });

  await fs.writeFile("data/blog/_candidates.txt", lines.join("\n"));
  await fs.writeFile("data/blog/_candidates.json", JSON.stringify(bundle, null, 2));
  console.log(`Matched ${articles.length} articles → data/blog/_candidates.txt`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
