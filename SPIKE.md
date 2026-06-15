# Feasibility spike: SEO clip-finder

Goal: prove the riskiest assumption before building anything heavy — **can we
reliably find the exact, timestamped moment where a channel's videos answer a
given SEO question?** If those moments exist and we can locate them precisely,
turning them into short clips is "just" rendering. If they don't, no pipeline
can save it.

This spike takes a YouTube channel (or a list of videos) plus a list of SEO
questions and produces a ranked report of answer-moments, each with a
deep-link, exact start/end timestamps, a confidence score, and a suggested
clip title. It does **not** cut video yet — that's the next phase.

## How it works

```
questions.txt ─┐
               ▼
[1] List the channel's videos            (YouTube Data API)
[2] Fetch transcripts WITH timestamps    (saved to data/transcripts/*.json + *.md)
[3] Pack transcripts into token-budgeted batches
[4] LLM locates answer spans per question (start/end seconds + confidence)
[5] Merge, dedupe, rank → report          (data/reports/clip-report.*)
```

### Why no Pinecone / vector database

For one channel (≤100 videos) mined in batches, a vector DB is overhead, not
leverage. The timestamped transcripts are saved to disk and the LLM reads the
actual lines, so it can pin exact start/end times — which is precisely what a
clip needs. To avoid feeding *every* transcript to the model for *every*
question, transcripts are packed into large batched calls (the model handles
retrieval + extraction together). A vector DB only starts to earn its place at
a different scale: many channels, tens of thousands of videos, or a persistent,
repeatedly-queried service.

### Swapping the model / provider

All LLM calls go through `scripts/lib/llm.ts`. Switching from OpenAI to Claude
or another provider means reimplementing that one function — nothing else
changes.

## Setup

```bash
npm install
brew install yt-dlp        # required to fetch timestamped transcripts
cp .env.example .env       # then fill in OPENAI_API_KEY (+ YOUTUBE_DATA_API_KEY for --channel)
```

- `OPENAI_API_KEY` — required (the matching step).
- `yt-dlp` — required: transcripts are pulled from YouTube's `json3` caption
  feed via yt-dlp. Install it on your PATH (`brew install yt-dlp`) or point
  `YT_DLP_PATH` at the binary. (This replaced the `youtube-transcript` scraper,
  which stopped returning cues against YouTube's current caption endpoint.)
- `YOUTUBE_DATA_API_KEY` — required only to auto-list a channel with `--channel`.
  A free key from a Google Cloud project with the "YouTube Data API v3" enabled.
  Not needed if you pass `--videos`.

## Run

Whole channel:

```bash
npm run find-clips -- --channel https://youtube.com/@truedialog
```

Just a handful of videos (no Data API key needed — put IDs or URLs in a file):

```bash
printf "dtVTLuA7DAE\nhttps://youtu.be/VIDEO_ID\n" > videos.txt
npm run find-clips -- --videos videos.txt
```

Useful options (see `--help` for all):

| Flag | Default | Purpose |
| --- | --- | --- |
| `--questions <file>` | `questions.txt` | Your SEO question list |
| `--max-videos <n>` | `50` | How many recent videos to mine |
| `--min-confidence <n>` | `0.55` | Bar for keeping a clip |
| `--model <name>` | `gpt-5.5` | Matching model (`gpt-5.4-mini` to economize) |

## Output

- `data/transcripts/<videoId>.json` — exact timestamped cues (the cache).
- `data/transcripts/<videoId>.md` — same, human-readable.
- `data/reports/clip-report.md` — ranked, readable report (open this).
- `data/reports/clip-report.json` — structured handoff for the clipping phase.

The report opens with a **coverage** line (how many questions got a confident
answer) and a per-question table, then lists each clip with its deep-link and
the transcript excerpt so a human can sanity-check it in one click.

## Cost & limits

- Embeddings/vector DB: none.
- LLM: a handful of batched calls (often just one for a small channel). Cost
  scales with model — `gpt-5.5` for best accuracy, `gpt-5.4-mini` to economize.
- Transcripts are fetched with yt-dlp from YouTube's `json3` caption feed; they
  can be missing (captions disabled) or rate-limited, and those videos are
  skipped and counted in the report. For production, owner-access captions or
  the original video files are more reliable.

## What this spike deliberately leaves for later

- **Rendering the clips** — `yt-dlp` to pull the source, `ffmpeg` to cut,
  reframe to 9:16, and burn in captions.
- **SEO/AEO packaging** — title/description/`VideoObject` schema for the embed.
- **Human review UI** — approve clips before publishing.
- **Publishing** — embed self-hosted clips in articles and/or upload Shorts to
  the channel (the latter needs channel OAuth).
