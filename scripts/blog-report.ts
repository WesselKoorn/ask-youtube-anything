import { promises as fs } from "fs";

/**
 * Render the blog → clip proof as a client-checkable HTML page: for each
 * article, the blog link, what the clip illustrates, the matched clip's
 * transcript, and the timestamped YouTube deep-link.
 */

interface Pick {
  slug: string;
  videoId: string;
  start: number;
  end: number;
  fit: string;
  sim: number;
  why: string;
}
interface Cue { start: number; duration: number; text: string }

function mmss(s: number): string {
  const x = Math.max(0, Math.floor(s));
  const h = Math.floor(x / 3600);
  const m = Math.floor((x % 3600) / 60);
  const ss = x % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(ss)}` : `${m}:${p(ss)}`;
}
function cuesToText(cues: Cue[], start: number, end: number): string {
  return cues
    .filter((c) => c.start + c.duration >= start && c.start <= end)
    .map((c) => c.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const FIT_CLS: Record<string, string> = { Strong: "b-strong", Good: "b-good", Moderate: "b-mod" };

const STYLE = `
:root{ --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --good:#2563eb;
  --strong:#15803d; --mod:#b45309; }
*{ box-sizing:border-box; }
body{ margin:0; color:var(--ink); background:#f1f5f9;
  font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.wrap{ max-width:880px; margin:0 auto; padding:32px 28px 56px; background:#fff; }
h1{ font-size:23px; margin:0 0 4px; letter-spacing:-.01em; }
.sub{ color:var(--muted); font-size:13px; margin:0 0 8px; }
.legend{ font-size:12px; color:var(--muted); margin:0 0 22px; }
.dot{ display:inline-block; width:9px; height:9px; border-radius:50%; margin:0 4px 0 12px; vertical-align:middle; }
.card{ border:1px solid var(--line); border-left-width:4px; border-radius:10px; padding:14px 16px; margin:0 0 14px; break-inside:avoid; }
.card.Strong{ border-left-color:var(--strong); } .card.Good{ border-left-color:var(--good); } .card.Moderate{ border-left-color:var(--mod); }
.head{ display:flex; align-items:flex-start; gap:10px; margin-bottom:6px; }
.article{ font-size:16px; font-weight:700; flex:1; }
.article a{ color:var(--ink); text-decoration:none; border-bottom:1px solid #cbd5e1; }
.badge{ font-size:11px; font-weight:700; padding:3px 9px; border-radius:999px; color:#fff; white-space:nowrap; }
.b-strong{ background:var(--strong); } .b-good{ background:var(--good); } .b-mod{ background:var(--mod); }
.why{ font-size:13px; color:#334155; margin:2px 0 10px; }
.why b{ color:var(--muted); font-weight:600; }
.clip{ margin:0 0 8px; }
.tlink{ display:inline-block; font-weight:600; color:var(--good); text-decoration:none;
  border:1px solid #dbeafe; background:#eff6ff; padding:3px 9px; border-radius:6px; font-size:13px; }
.vtitle{ color:var(--muted); font-size:12.5px; margin-left:6px; }
.excerpt{ font-size:13px; color:#475569; background:#f8fafc; border-left:2px solid var(--line);
  border-radius:6px; padding:9px 11px; }
.foot{ color:var(--muted); font-size:12px; margin-top:30px; border-top:1px solid var(--line); padding-top:12px; }
a.blue{ color:var(--good); }
@media print{ body{ background:#fff; } .wrap{ padding:0; max-width:none; } .card{ break-inside:avoid; } }
`;

async function main(): Promise<void> {
  const picks: Pick[] = JSON.parse(await fs.readFile("data/blog/_picks.json", "utf8"));
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const cards: string[] = [];
  for (const p of picks) {
    const md = await fs.readFile(`data/blog/${p.slug}.md`, "utf8");
    const title = (md.split("\n")[0] || "").replace(/^#+\s*/, "").trim();
    const url = `https://www.truedialog.com/resources/blog/${p.slug}/`;
    const t = JSON.parse(await fs.readFile(`data/transcripts/${p.videoId}.json`, "utf8"));
    const excerpt = cuesToText(t.cues || [], p.start, p.end);
    const videoTitle = t.title || p.videoId;
    const deepLink = `https://www.youtube.com/watch?v=${p.videoId}&t=${Math.floor(p.start)}s`;

    cards.push(
      `<div class="card ${esc(p.fit)}">` +
        `<div class="head"><div class="article"><a href="${esc(url)}">${esc(title)}</a></div>` +
        `<div class="badge ${FIT_CLS[p.fit]}">${esc(p.fit)} · ${p.sim.toFixed(2)}</div></div>` +
        `<div class="why"><b>Clip illustrates:</b> ${esc(p.why)}</div>` +
        `<div class="clip"><a class="tlink" href="${esc(deepLink)}">▶ Watch @ ${mmss(p.start)}–${mmss(p.end)}</a>` +
        `<span class="vtitle">${esc(videoTitle)}</span></div>` +
        `<div class="excerpt">“${esc(excerpt)}”</div>` +
        `</div>`
    );
  }

  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>TrueDialog — Blog → Video Clip Matches</title><style>${STYLE}</style></head><body><div class="wrap">` +
    `<h1>Blog → Video Clip Matches</h1>` +
    `<p class="sub">${picks.length}-article proof · matched by semantic retrieval over video transcripts, then verified by Claude Opus 4.8 · ${esc(date)}</p>` +
    `<p class="legend">A short clip cut from each video moment can be embedded in the linked article.` +
    `<span class="dot" style="background:#15803d"></span>Strong` +
    `<span class="dot" style="background:#2563eb"></span>Good` +
    `<span class="dot" style="background:#b45309"></span>Moderate · score = semantic similarity (0–1)</p>` +
    cards.join("\n") +
    `<p class="foot">Each clip's transcript is the spoken text at the linked timestamp. Click an article title for the blog post, or “Watch” to jump into the YouTube video at that moment.</p>` +
    `</div></body></html>`;

  await fs.writeFile("data/reports/blog-clip-report.html", html);
  console.log("Wrote data/reports/blog-clip-report.html");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
