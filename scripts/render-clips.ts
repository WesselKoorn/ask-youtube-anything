import "dotenv/config";

import { execFile } from "child_process";
import { constants as fsConstants, existsSync, promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

import { createCanvas, GlobalFonts } from "@napi-rs/canvas";

const execFileAsync = promisify(execFile);

// Register a bold system font for caption rendering (first that exists wins).
const CAPTION_FONT = "CaptionFont";
for (const fontPath of [
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/System/Library/Fonts/HelveticaNeue.ttc",
  "/System/Library/Fonts/Helvetica.ttc",
]) {
  if (existsSync(fontPath)) {
    GlobalFonts.registerFromPath(fontPath, CAPTION_FONT);
    break;
  }
}

/**
 * Rendering phase of the SEO clip-finder spike.
 *
 * Takes the ranked clips from `clip-report.json` and turns each one into a
 * ready-to-publish 9:16 short: download just the answer segment with yt-dlp,
 * reframe to vertical with a blurred-fill background, and burn in captions
 * built from the cached timestamped transcript cues.
 *
 * The clip-finder proved the moments exist and are precisely located; this
 * proves they can be cut into shorts. (Still a prototype: no human-review UI,
 * SEO packaging, or publishing — see SPIKE.md.)
 */

// ---------- types (a subset of data/reports/clip-report.json) ----------

interface Cue {
  start: number;
  duration: number;
  text: string;
}

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
}

interface Report {
  results: { question: string; clips: Clip[] }[];
}

// ---------- config ----------

interface RenderConfig {
  reportPath: string;
  cacheDir: string;
  outDir: string;
  limit: number;
  minConfidence: number;
  onlyVideo?: string;
  captions: boolean;
  width: number;
  height: number;
}

const HELP = `
render-clips — cut ranked answer-moments into 9:16 captioned shorts

Usage:
  npm run render-clips -- [options]

Options:
  --report <file>        Clip report JSON (default: data/reports/clip-report.json)
  --out <dir>            Output dir for rendered mp4s (default: data/clips)
  --cache-dir <dir>      Timestamped transcript cache (default: data/transcripts)
  --limit <n>            Render the top-N clips (default: 3; prefers variety)
  --all                  Render every clip in the report
  --min-confidence <n>   Only render clips at/above this confidence (default: 0.7)
  --video <id>           Only render clips from this video id
  --no-captions          Skip burned-in captions (for already-captioned sources)
  -h, --help             Show this help

Requires yt-dlp and ffmpeg on PATH (or $YT_DLP_PATH / $FFMPEG_PATH).
`;

function parseArgs(argv: string[]): RenderConfig {
  const cfg: RenderConfig = {
    reportPath: "data/reports/clip-report.json",
    cacheDir: "data/transcripts",
    outDir: "data/clips",
    limit: 3,
    minConfidence: 0.7,
    captions: true,
    width: 1080,
    height: 1920,
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
      case "--out": cfg.outDir = next(); break;
      case "--cache-dir": cfg.cacheDir = next(); break;
      case "--limit": cfg.limit = Number(next()); break;
      case "--all": cfg.limit = Infinity; break;
      case "--min-confidence": cfg.minConfidence = Number(next()); break;
      case "--video": cfg.onlyVideo = next(); break;
      case "--no-captions": cfg.captions = false; break;
      case "-h":
      case "--help":
        process.stdout.write(HELP);
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg} (try --help)`);
    }
  }

  return cfg;
}

// ---------- binary resolution ----------

async function resolveBin(name: string, envVar: string): Promise<string> {
  const candidates = [
    process.env[envVar],
    path.join(os.homedir(), ".local", "bin", name),
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
  ].filter((c): c is string => Boolean(c));

  for (const candidate of candidates) {
    try {
      await fs.access(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // try next
    }
  }
  return name; // rely on PATH
}

// ---------- clip selection ----------

function selectClips(report: Report, cfg: RenderConfig): Clip[] {
  const ranked = report.results
    .flatMap((r) => r.clips)
    .filter((c) => c.confidence >= cfg.minConfidence)
    .filter((c) => !cfg.onlyVideo || c.videoId === cfg.onlyVideo)
    .sort((a, b) => b.confidence - a.confidence);

  // De-dupe overlapping spans (the same moment can answer several questions).
  const seen = new Set<string>();
  const unique: Clip[] = [];
  for (const c of ranked) {
    const key = `${c.videoId}:${Math.round(c.startTime)}:${Math.round(c.endTime)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }

  if (cfg.limit === Infinity) return unique;

  // For a small sample, lead with distinct videos so the demo shows variety.
  const distinctFirst = [
    ...new Map(unique.map((c) => [c.videoId, c])).values(),
  ];
  const rest = unique.filter((c) => !distinctFirst.includes(c));
  return [...distinctFirst, ...rest].slice(0, cfg.limit);
}

// ---------- captions (ASS, built from cached cues) ----------

async function loadCues(cacheDir: string, videoId: string): Promise<Cue[]> {
  try {
    const data = JSON.parse(
      await fs.readFile(path.join(cacheDir, `${videoId}.json`), "utf8")
    );
    return (data.cues ?? []) as Cue[];
  } catch {
    return [];
  }
}

interface Caption {
  start: number; // seconds from clip start
  end: number;
  text: string;
}

/** Cues overlapping the clip window, re-timed to start at 0. */
function captionsForWindow(cues: Cue[], start: number, end: number): Caption[] {
  const captions: Caption[] = [];
  for (const cue of cues) {
    const cueEnd = cue.start + (cue.duration || 2);
    if (cueEnd <= start || cue.start >= end) continue; // outside clip window

    const from = Math.max(0, cue.start - start);
    const to = Math.min(cueEnd, end) - start;
    const text = cue.text.replace(/\s+/g, " ").trim();
    if (text) captions.push({ start: from, end: to, text });
  }

  // Auto-caption cue durations overlap (the rolling-scroll effect), which would
  // put two captions on screen at once. Clamp each caption's end to the next
  // one's start so exactly one shows at a time.
  captions.sort((a, b) => a.start - b.start);
  for (let i = 0; i < captions.length - 1; i++) {
    captions[i].end = Math.min(captions[i].end, captions[i + 1].start);
  }
  return captions.filter((c) => c.end - c.start > 0.05);
}

/**
 * Render one caption as a full-frame transparent PNG — bold white text with a
 * heavy outline, wrapped and placed in the lower third. Full-frame keeps the
 * ffmpeg overlay trivial (always 0:0), and rendering text here means we don't
 * need a libass-enabled ffmpeg to burn captions in.
 */
function renderCaptionPng(text: string, cfg: RenderConfig): Buffer {
  const { width: W, height: H } = cfg;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const fontSize = Math.round(W * 0.054); // ~58px at 1080 wide
  const lineHeight = fontSize * 1.2;
  ctx.font = `bold ${fontSize}px ${CAPTION_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // word-wrap to the safe width
  const maxWidth = W - 170;
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);

  const blockHeight = lines.length * lineHeight;
  const centerY = H - Math.round(H * 0.25); // lower third
  const firstY = centerY - blockHeight / 2 + lineHeight / 2;

  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 10;
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.round(fontSize * 0.22);
  ctx.strokeStyle = "rgba(0,0,0,0.95)";
  ctx.fillStyle = "#ffffff";

  lines.forEach((textLine, i) => {
    const y = firstY + i * lineHeight;
    ctx.strokeText(textLine, W / 2, y);
    ctx.fillText(textLine, W / 2, y);
  });

  return canvas.toBuffer("image/png");
}

// ---------- render one clip ----------

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "clip"
  );
}

function clock(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

interface Bins {
  ytDlp: string;
  ffmpeg: string;
}

async function renderClip(
  clip: Clip,
  index: number,
  cfg: RenderConfig,
  bins: Bins
): Promise<string> {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), `render-${clip.videoId}-`));
  try {
    // 1) build a caption PNG per cue from the cached timestamped transcript
    const capFiles: Array<{ file: string; start: number; end: number }> = [];
    if (cfg.captions) {
      const cues = await loadCues(cfg.cacheDir, clip.videoId);
      const captions = captionsForWindow(cues, clip.startTime, clip.endTime);
      for (let i = 0; i < captions.length; i++) {
        const file = path.join(work, `cap${i}.png`);
        await fs.writeFile(file, renderCaptionPng(captions[i].text, cfg));
        capFiles.push({ file, start: captions[i].start, end: captions[i].end });
      }
    }

    // 2) download just the answer segment (frame-accurate cut)
    await execFileAsync(
      bins.ytDlp,
      [
        "-f",
        "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--download-sections",
        `*${clip.startTime.toFixed(2)}-${clip.endTime.toFixed(2)}`,
        "--force-keyframes-at-cuts",
        "--merge-output-format",
        "mp4",
        "--no-warnings",
        "--no-playlist",
        "-o",
        path.join(work, "src.%(ext)s"),
        "--",
        clip.videoId,
      ],
      { maxBuffer: 1 << 28 }
    );

    const srcName = (await fs.readdir(work)).find((f) => f.startsWith("src."));
    if (!srcName) throw new Error("yt-dlp produced no source segment");
    const src = path.join(work, srcName);

    // 3) reframe to 9:16 (blurred fill), then overlay each caption in its window
    await fs.mkdir(cfg.outDir, { recursive: true });
    const outName = `${String(index + 1).padStart(2, "0")}-${slug(
      clip.clipTitle || clip.question
    )}.mp4`;
    const outPath = path.join(cfg.outDir, outName);

    const { width: W, height: H } = cfg;
    let filter =
      `[0:v]split=2[bg][fg];` +
      `[bg]scale=${W}:${H}:force_original_aspect_ratio=increase,` +
      `crop=${W}:${H},boxblur=20:5,eq=brightness=-0.08[bg2];` +
      `[fg]scale=${W}:${H}:force_original_aspect_ratio=decrease[fg2];` +
      `[bg2][fg2]overlay=(W-w)/2:(H-h)/2[base]`;

    let last = "base";
    capFiles.forEach((cap, i) => {
      const out = `c${i}`;
      filter +=
        `;[${last}][${i + 1}:v]overlay=0:0:` +
        `enable='between(t,${cap.start.toFixed(2)},${cap.end.toFixed(2)})'[${out}]`;
      last = out;
    });

    const inputs = ["-i", src];
    for (const cap of capFiles) inputs.push("-i", cap.file);

    await execFileAsync(
      bins.ffmpeg,
      [
        "-y",
        ...inputs,
        "-filter_complex",
        filter,
        "-map",
        `[${last}]`,
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-movflags",
        "+faststart",
        outPath,
      ],
      { maxBuffer: 1 << 28 }
    );

    return outPath;
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }
}

// ---------- main ----------

async function main(): Promise<void> {
  const cfg = parseArgs(process.argv.slice(2));

  const report: Report = JSON.parse(await fs.readFile(cfg.reportPath, "utf8"));
  const clips = selectClips(report, cfg);
  if (clips.length === 0) {
    console.log("No clips matched the selection.");
    return;
  }

  const bins: Bins = {
    ytDlp: await resolveBin("yt-dlp", "YT_DLP_PATH"),
    ffmpeg: await resolveBin("ffmpeg", "FFMPEG_PATH"),
  };

  console.log(`Rendering ${clips.length} clip(s) → ${cfg.outDir}\n`);

  const manifest: Array<Clip & { output: string }> = [];
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    process.stdout.write(
      `  [${i + 1}/${clips.length}] ${c.videoId} ${clock(c.startTime)}–${clock(
        c.endTime
      )} · "${c.clipTitle}" … `
    );
    try {
      const output = await renderClip(c, i, cfg, bins);
      const size = (await fs.stat(output)).size;
      console.log(`ok (${(size / 1e6).toFixed(1)} MB)`);
      manifest.push({ ...c, output });
    } catch (error) {
      console.log(`FAILED: ${(error as Error).message.split("\n")[0]}`);
    }
  }

  await fs.writeFile(
    path.join(cfg.outDir, "index.json"),
    JSON.stringify(manifest, null, 2)
  );
  console.log(
    `\nDone: ${manifest.length}/${clips.length} rendered. ` +
      `Manifest: ${path.join(cfg.outDir, "index.json")}`
  );
}

main().catch((error) => {
  console.error(`\nError: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
