import { promises as fs } from "fs";

/**
 * Build a concise, client-ready HTML overview from clip-report.json.
 *
 * Groups questions by the `## ` categories in questions.txt and, per question,
 * shows whether it is answered in the channel's videos — with the best clip's
 * timestamped deep-link, the spoken-answer excerpt, and a match-confidence
 * score. Designed to be skimmed and to print cleanly to PDF.
 */

interface Clip {
  question: string;
  videoId: string;
  videoTitle: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  confidence: number;
  clipTitle: string;
  answerSummary: string;
  transcriptText: string;
  deepLink: string;
}

interface Report {
  source: string;
  model: string;
  generatedAt: string;
  minConfidence: number;
  profile: {
    videoCount: number;
    withTranscripts: number;
    failedCount: number;
    totalTranscriptSeconds: number;
  };
  results: { question: string; clips: Clip[] }[];
}

interface Category {
  category: string;
  questions: string[];
}

interface Cfg {
  reportPath: string;
  questionsPath: string;
  outPath: string;
}

function parseArgs(argv: string[]): Cfg {
  const cfg: Cfg = {
    reportPath: "data/reports/clip-report.json",
    questionsPath: "questions.txt",
    outPath: "data/reports/clip-report.html",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) throw new Error(`Missing value for ${arg}`);
      return value;
    };
    switch (arg) {
      case "--report": cfg.reportPath = next(); break;
      case "--questions": cfg.questionsPath = next(); break;
      case "--out": cfg.outPath = next(); break;
      case "-h":
      case "--help":
        process.stdout.write(
          "Usage: npm run report-html -- [--report f] [--questions f] [--out f]\n"
        );
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return cfg;
}

/** Parse questions.txt into ordered categories (## headers) + their questions. */
function parseBank(text: string): Category[] {
  const categories: Category[] = [];
  let current: Category | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("## ")) {
      current = { category: line.slice(3).trim(), questions: [] };
      categories.push(current);
    } else if (line.startsWith("#")) {
      continue; // boilerplate comment
    } else {
      if (!current) {
        current = { category: "Questions", questions: [] };
        categories.push(current);
      }
      current.questions.push(line);
    }
  }
  return categories;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mmss(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(ss)}` : `${m}:${p(ss)}`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n).trim()}…` : s;
}

type Bucket = "strong" | "good" | "partial" | "gap";

function bucketOf(best: number | null): Bucket {
  if (best === null || best < 0.5) return "gap";
  if (best < 0.6) return "partial";
  if (best < 0.75) return "good";
  return "strong";
}

const BADGE: Record<Bucket, { label: string; cls: string }> = {
  strong: { label: "Answered", cls: "b-strong" },
  good: { label: "Answered", cls: "b-good" },
  partial: { label: "Partial", cls: "b-partial" },
  gap: { label: "Not found", cls: "b-gap" },
};

const STYLE = `
:root{ --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --bg:#ffffff;
  --strong:#15803d; --good:#2563eb; --partial:#b45309; --gap:#94a3b8; }
*{ box-sizing:border-box; }
body{ margin:0; color:var(--ink); background:#f1f5f9;
  font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.wrap{ max-width:920px; margin:0 auto; padding:32px 28px 64px; background:var(--bg); }
h1{ font-size:24px; margin:0 0 4px; letter-spacing:-.01em; }
.sub{ color:var(--muted); font-size:13px; margin:0 0 24px; }
.stats{ display:flex; gap:12px; flex-wrap:wrap; margin:0 0 24px; }
.stat{ flex:1; min-width:120px; border:1px solid var(--line); border-radius:10px; padding:12px 14px; }
.stat .n{ font-size:26px; font-weight:700; line-height:1; }
.stat .l{ font-size:12px; color:var(--muted); margin-top:4px; }
.n.answered{ color:var(--strong); } .n.partial{ color:var(--partial); } .n.gap{ color:#475569; }
table.cov{ width:100%; border-collapse:collapse; margin:0 0 8px; font-size:13px; }
table.cov td{ padding:7px 8px; border-bottom:1px solid var(--line); vertical-align:middle; }
table.cov td.name{ font-weight:600; }
table.cov td.bar{ width:42%; }
.bartrack{ background:#eef2f7; border-radius:6px; height:9px; width:100%; overflow:hidden; display:flex; }
.barfill.s{ background:var(--strong); } .barfill.p{ background:var(--partial); }
.right{ text-align:right; color:var(--muted); white-space:nowrap; }
h2{ font-size:17px; margin:30px 0 6px; padding-top:6px; }
h2 .cnt{ font-size:13px; font-weight:500; color:var(--muted); }
.q{ border:1px solid var(--line); border-left-width:4px; border-radius:8px;
  padding:12px 14px; margin:10px 0; break-inside:avoid; }
.q.strong{ border-left-color:var(--strong); } .q.good{ border-left-color:var(--good); }
.q.partial{ border-left-color:var(--partial); } .q.gap{ border-left-color:var(--gap); background:#f8fafc; }
.qhead{ display:flex; align-items:flex-start; gap:10px; }
.qtext{ font-weight:600; flex:1; }
.badge{ font-size:11px; font-weight:700; padding:3px 8px; border-radius:999px; white-space:nowrap; color:#fff; }
.b-strong{ background:var(--strong); } .b-good{ background:var(--good); }
.b-partial{ background:var(--partial); } .b-gap{ background:var(--gap); }
.conf{ font-size:12px; font-weight:700; color:var(--muted); white-space:nowrap; }
.meta{ font-size:12.5px; color:var(--muted); margin:8px 0 0; }
.tlink{ display:inline-block; font-weight:600; color:var(--good); text-decoration:none;
  border:1px solid #dbeafe; background:#eff6ff; padding:1px 7px; border-radius:6px; }
.vtitle{ color:#334155; }
.excerpt{ font-size:12.5px; color:#475569; margin:8px 0 0; padding:8px 10px;
  background:#f8fafc; border-radius:6px; border-left:2px solid var(--line); }
.more{ font-size:12px; color:var(--muted); margin:6px 0 0; }
.more a{ color:var(--good); text-decoration:none; }
.foot{ color:var(--muted); font-size:12px; margin-top:36px; border-top:1px solid var(--line); padding-top:12px; }
@media print{ body{ background:#fff; } .wrap{ padding:0; max-width:none; } .q{ break-inside:avoid; } h2{ break-after:avoid; } }
`;

function render(report: Report, bank: Category[]): string {
  const byQuestion = new Map<string, Clip[]>();
  for (const group of report.results) byQuestion.set(group.question, group.clips);

  let answered = 0;
  let partial = 0;
  let gap = 0;
  let total = 0;

  const catStats = bank.map((cat) => {
    let a = 0;
    let p = 0;
    let g = 0;
    for (const q of cat.questions) {
      const clips = byQuestion.get(q) ?? [];
      const best = clips.length ? clips[0].confidence : null;
      const b = bucketOf(best);
      if (b === "gap") g++;
      else if (b === "partial") p++;
      else a++;
    }
    total += cat.questions.length;
    answered += a;
    partial += p;
    gap += g;
    return { cat, a, p, g };
  });

  const handle = report.source.replace(/^https?:\/\/(www\.)?youtube\.com\//, "");
  const date = new Date(report.generatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const minutes = Math.round(report.profile.totalTranscriptSeconds / 60);

  const parts: string[] = [];
  parts.push(`<!doctype html><html lang="en"><head><meta charset="utf-8">`);
  parts.push(`<meta name="viewport" content="width=device-width,initial-scale=1">`);
  parts.push(`<title>TrueDialog — YouTube Answer Coverage</title>`);
  parts.push(`<style>${STYLE}</style></head><body><div class="wrap">`);

  parts.push(`<h1>YouTube Answer Coverage — ${esc(handle)}</h1>`);
  parts.push(
    `<p class="sub">Which of ${total} target questions are answered on the channel today · ` +
      `${report.profile.withTranscripts} videos analysed (~${minutes} min) · ` +
      `generated ${esc(date)}</p>`
  );

  parts.push(`<div class="stats">`);
  parts.push(`<div class="stat"><div class="n answered">${answered}</div><div class="l">Answered (of ${total})</div></div>`);
  parts.push(`<div class="stat"><div class="n partial">${partial}</div><div class="l">Partial / related</div></div>`);
  parts.push(`<div class="stat"><div class="n gap">${gap}</div><div class="l">Gaps (not covered)</div></div>`);
  parts.push(`</div>`);

  // coverage table
  parts.push(`<table class="cov">`);
  for (const { cat, a, p, g } of catStats) {
    const n = cat.questions.length;
    const sPct = Math.round((a / n) * 100);
    const pPct = Math.round((p / n) * 100);
    parts.push(
      `<tr><td class="name">${esc(cat.category)}</td>` +
        `<td class="bar"><div class="bartrack">` +
        `<div class="barfill s" style="width:${sPct}%"></div>` +
        `<div class="barfill p" style="width:${pPct}%"></div></div></td>` +
        `<td class="right">${a}/${n} answered${p ? ` · ${p} partial` : ""}</td></tr>`
    );
  }
  parts.push(`</table>`);

  // per-category detail
  for (const { cat, a, p } of catStats) {
    parts.push(
      `<h2>${esc(cat.category)} <span class="cnt">— ${a}/${cat.questions.length} answered${
        p ? `, ${p} partial` : ""
      }</span></h2>`
    );
    for (const q of cat.questions) {
      const clips = byQuestion.get(q) ?? [];
      const best = clips.length ? clips[0] : null;
      const b = bucketOf(best ? best.confidence : null);
      const badge = BADGE[b];

      parts.push(`<div class="q ${b}">`);
      parts.push(`<div class="qhead"><div class="qtext">${esc(q)}</div>`);
      if (best) {
        parts.push(`<div class="conf">${Math.round(best.confidence * 100)}%</div>`);
      }
      parts.push(`<div class="badge ${badge.cls}">${badge.label}</div></div>`);

      if (best) {
        parts.push(
          `<div class="meta">` +
            `<a class="tlink" href="${esc(best.deepLink)}">▶ ${mmss(best.startTime)}–${mmss(best.endTime)}</a> ` +
            `<span class="vtitle">${esc(best.videoTitle)}</span></div>`
        );
        const excerpt = best.answerSummary
          ? `${best.answerSummary} `
          : "";
        parts.push(
          `<div class="excerpt">${esc(excerpt)}<em>“${esc(truncate(best.transcriptText, 420))}”</em></div>`
        );
        if (clips.length > 1) {
          const extra = clips
            .slice(1, 4)
            .map(
              (c) =>
                `<a href="${esc(c.deepLink)}">${mmss(c.startTime)}</a> (${Math.round(
                  c.confidence * 100
                )}%, ${esc(truncate(c.videoTitle, 40))})`
            )
            .join(" · ");
          const more = clips.length > 4 ? ` · +${clips.length - 4} more` : "";
          parts.push(`<div class="more">Also at: ${extra}${more}</div>`);
        }
      } else {
        parts.push(
          `<div class="meta">No clip found at or above 50% confidence — likely a content gap / opportunity.</div>`
        );
      }
      parts.push(`</div>`);
    }
  }

  parts.push(
    `<p class=”foot”>Each match is located by gpt-5.5, then <strong>verified and re-timed by Claude Opus 4.8</strong> ` +
      `against the actual transcript. “Confidence” (0–100%) reflects how directly the linked moment answers the ` +
      `question. Answered ≥ 60% · Partial 50–60% · Gap &lt; 50%. Timestamps deep-link into the source video.</p>`
  );
  parts.push(`</div></body></html>`);
  return parts.join("\n");
}

async function main(): Promise<void> {
  const cfg = parseArgs(process.argv.slice(2));
  const report: Report = JSON.parse(await fs.readFile(cfg.reportPath, "utf8"));
  const bank = parseBank(await fs.readFile(cfg.questionsPath, "utf8"));
  const html = render(report, bank);
  await fs.writeFile(cfg.outPath, html);
  console.log(`Wrote ${cfg.outPath}`);
}

main().catch((error) => {
  console.error(`\nError: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
