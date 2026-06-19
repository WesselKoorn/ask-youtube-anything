import { promises as fs } from "fs";

/**
 * Build the full blog → clip report from the curated picks (picks-full.json)
 * over the retrieval candidates (_match.json). Each pick resolves to a clip;
 * the transcript excerpt is recomputed from the cached cues for that window.
 */

interface Cand { videoId: string; videoTitle: string; start: number; end: number; score: number }
interface MatchRow { slug: string; url: string; bestSim: number; candidates: Cand[] }
interface Pick { i?: number; v?: string; s?: number; e?: number; f: "S" | "G" }
interface Cue { start: number; duration: number; text: string }

const FIT: Record<string, { label: string; cls: string }> = {
  S: { label: "Strong", cls: "b-strong" },
  G: { label: "Good", cls: "b-good" },
};

const ACR: Record<string, string> = {
  rcs: "RCS", sms: "SMS", mms: "MMS", crm: "CRM", tcpa: "TCPA", b2b: "B2B",
  cpg: "CPG", a2p: "A2P", "10dlc": "10DLC", qr: "QR", ai: "AI", roi: "ROI",
  api: "API", scotus: "SCOTUS", revops: "RevOps", hubspot: "HubSpot",
  salesforce: "Salesforce", dynamics: "Dynamics", eloqua: "Eloqua",
  five9: "Five9", us: "US", "365": "365",
};

function prettyTitle(slug: string): string {
  return slug.split("-").map((w) => ACR[w.toLowerCase()] || w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
function mmss(s: number): string {
  const x = Math.max(0, Math.floor(s));
  const h = Math.floor(x / 3600);
  const m = Math.floor((x % 3600) / 60);
  const ss = x % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(ss)}` : `${m}:${p(ss)}`;
}
function cuesToText(cues: Cue[], start: number, end: number): string {
  return cues.filter((c) => c.start + c.duration >= start && c.start <= end).map((c) => c.text).join(" ").replace(/\s+/g, " ").trim();
}
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const STYLE = `
:root{ --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --good:#2563eb; --strong:#15803d; }
*{ box-sizing:border-box; }
body{ margin:0; color:var(--ink); background:#f1f5f9; font:14.5px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.wrap{ max-width:900px; margin:0 auto; padding:30px 26px 52px; background:#fff; }
h1{ font-size:23px; margin:0 0 4px; }
.sub{ color:var(--muted); font-size:13px; margin:0 0 18px; }
.stats{ display:flex; gap:12px; margin:0 0 22px; flex-wrap:wrap; }
.stat{ border:1px solid var(--line); border-radius:10px; padding:10px 14px; min-width:110px; }
.stat .n{ font-size:24px; font-weight:700; line-height:1; } .stat .n.s{ color:var(--strong); } .stat .n.g{ color:var(--good); }
.stat .l{ font-size:11.5px; color:var(--muted); margin-top:3px; }
h2{ font-size:16px; margin:26px 0 10px; }
.card{ border:1px solid var(--line); border-left-width:4px; border-radius:8px; padding:10px 13px; margin:0 0 9px; break-inside:avoid; }
.card.Strong{ border-left-color:var(--strong); } .card.Good{ border-left-color:var(--good); }
.head{ display:flex; align-items:flex-start; gap:10px; }
.article{ font-weight:700; flex:1; font-size:14.5px; }
.article a{ color:var(--ink); text-decoration:none; border-bottom:1px solid #cbd5e1; }
.badge{ font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:999px; color:#fff; white-space:nowrap; }
.b-strong{ background:var(--strong); } .b-good{ background:var(--good); }
.clip{ margin:6px 0 0; font-size:12.5px; }
.tlink{ font-weight:600; color:var(--good); text-decoration:none; border:1px solid #dbeafe; background:#eff6ff; padding:1px 7px; border-radius:6px; }
.vtitle{ color:var(--muted); }
.excerpt{ font-size:12px; color:#475569; background:#f8fafc; border-left:2px solid var(--line); border-radius:5px; padding:7px 9px; margin-top:7px; }
.foot{ color:var(--muted); font-size:12px; margin-top:30px; border-top:1px solid var(--line); padding-top:12px; }
@media print{ body{ background:#fff; } .wrap{ padding:0; max-width:none; } .card{ break-inside:avoid; } h2{ break-after:avoid; } }
`;

async function main(): Promise<void> {
  const picks: Record<string, Pick> = JSON.parse(await fs.readFile("data/blog/picks-full.json", "utf8"));
  const match: MatchRow[] = JSON.parse(await fs.readFile("data/blog/_match.json", "utf8"));
  const bySlug = new Map(match.map((m) => [m.slug, m]));
  const totalArticles = (await fs.readFile("data/blog/urls.txt", "utf8")).split("\n").filter(Boolean).length;

  const cueCache: Record<string, Cue[]> = {};
  const titleCache: Record<string, string> = {};
  async function cues(id: string): Promise<Cue[]> {
    if (!cueCache[id]) {
      const d = JSON.parse(await fs.readFile(`data/transcripts/${id}.json`, "utf8"));
      cueCache[id] = d.cues || [];
      titleCache[id] = d.title || id;
    }
    return cueCache[id];
  }

  const sections: Record<string, string[]> = { S: [], G: [] };
  for (const [slug, p] of Object.entries(picks)) {
    if (slug.startsWith("_")) continue;
    let videoId: string; let start: number; let end: number; let videoTitle: string | undefined;
    if (p.v) { videoId = p.v; start = p.s!; end = p.e!; }
    else {
      const c = bySlug.get(slug)!.candidates[p.i ?? 0];
      videoId = c.videoId; start = c.start; end = c.end; videoTitle = c.videoTitle;
    }
    const cs = await cues(videoId);
    if (!videoTitle) videoTitle = titleCache[videoId];
    const excerpt = cuesToText(cs, start, end);
    const url = bySlug.get(slug)?.url || `https://www.truedialog.com/resources/blog/${slug}/`;
    const deepLink = `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(start)}s`;
    const fitName = p.f === "S" ? "Strong" : "Good";
    sections[p.f].push(
      `<div class="card ${fitName}">` +
        `<div class="head"><div class="article"><a href="${esc(url)}">${esc(prettyTitle(slug))}</a></div>` +
        `<div class="badge ${FIT[p.f].cls}">${FIT[p.f].label}</div></div>` +
        `<div class="clip"><a class="tlink" href="${esc(deepLink)}">▶ ${mmss(start)}</a> <span class="vtitle">${esc(videoTitle!)}</span></div>` +
        `<div class="excerpt">“${esc(excerpt.slice(0, 300))}${excerpt.length > 300 ? "…" : ""}”</div>` +
        `</div>`
    );
  }

  const nS = sections.S.length;
  const nG = sections.G.length;
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>TrueDialog — Blog → Clip Matches (full)</title><style>${STYLE}</style></head><body><div class="wrap">` +
    `<h1>Blog → Video Clip Matches — full blog</h1>` +
    `<p class="sub">All ${totalArticles} blog articles matched against the video library by semantic retrieval, then verified by Claude Opus 4.8 · ${esc(date)}</p>` +
    `<div class="stats">` +
    `<div class="stat"><div class="n s">${nS}</div><div class="l">Strong matches</div></div>` +
    `<div class="stat"><div class="n g">${nG}</div><div class="l">Good matches</div></div>` +
    `<div class="stat"><div class="n">${nS + nG}</div><div class="l">Total clip-ready (of ${totalArticles})</div></div>` +
    `<div class="stat"><div class="n">${totalArticles - nS - nG}</div><div class="l">No strong clip</div></div>` +
    `</div>` +
    `<h2>Strong matches — clip closely illustrates the article</h2>${sections.S.join("\n")}` +
    `<h2>Good matches — clip is clearly relevant</h2>${sections.G.join("\n")}` +
    `<p class="foot">Matched by embedding the article title against ${"transcript chunks"}, then Opus 4.8 verified the pick. The remaining ${totalArticles - nS - nG} articles are off-topic for the current ${36}-video library (e.g. general mobile-marketing, events, real estate) and have no specific clip — they're candidates for new video content. Click an article title for the post, or ▶ to jump into the source video.</p>` +
    `</div></body></html>`;

  await fs.writeFile("data/reports/blog-clip-report-full.html", html);
  console.log(`Strong ${nS}, Good ${nG}, clip-ready ${nS + nG}/${totalArticles}.`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
