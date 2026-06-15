import { promises as fs } from "fs";
import path from "path";

import { YoutubeService } from "@api/services/youtube-service";
import { VideoTranscript } from "@models/transcript";
import { YoutubeVideo } from "@models/youtube-video";

import { CliConfig } from "./args";
import { formatTimestamp, mapLimit } from "./util";

const YOUTUBE_DATA_API_URL = "https://youtube.googleapis.com/youtube/v3";

/**
 * Resolve the set of videos to mine, either by listing a channel (YouTube Data
 * API) or by reading an explicit list of video IDs / URLs from a file.
 */
export async function resolveVideos(config: CliConfig): Promise<YoutubeVideo[]> {
  if (config.channelUrl) {
    return resolveChannelVideos(config.channelUrl, config.maxVideos);
  }

  if (config.videosFile) {
    return resolveVideosFromFile(config.videosFile, config.maxVideos);
  }

  return [];
}

async function resolveChannelVideos(
  channelUrl: string,
  maxVideos: number
): Promise<YoutubeVideo[]> {
  if (!process.env.YOUTUBE_DATA_API_KEY) {
    throw new Error(
      "YOUTUBE_DATA_API_KEY is required to list a channel. " +
        "Either set it in .env, or use --videos <file> with explicit video IDs."
    );
  }

  const handle = YoutubeService.extractHandleFromUrl(channelUrl);
  if (!handle) throw new Error(`Could not parse a handle from URL: ${channelUrl}`);

  const channelId = await YoutubeService.getChannelId(handle);
  const uploadsPlaylistId = await YoutubeService.getUploadsPlaylistId(channelId);
  if (!uploadsPlaylistId) {
    throw new Error(`No uploads playlist found for channel: ${channelId}`);
  }

  const videos = await YoutubeService.fetchPlaylistVideos(
    uploadsPlaylistId,
    maxVideos
  );

  return videos.slice(0, maxVideos);
}

async function resolveVideosFromFile(
  videosFile: string,
  maxVideos: number
): Promise<YoutubeVideo[]> {
  const raw = await fs.readFile(videosFile, "utf8");
  const ids = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map(extractVideoId)
    .filter((id): id is string => Boolean(id))
    .slice(0, maxVideos);

  const titles = await fetchVideoTitles(ids);

  return ids.map((videoId) => ({
    videoId,
    title: titles[videoId] ?? videoId,
    description: "",
    thumbnailUrl: "",
    publishedAt: "",
    channelId: "",
  }));
}

/** Extract an 11-char YouTube video ID from a bare ID or any common URL form. */
export function extractVideoId(input: string): string | null {
  const bare = input.match(/^[A-Za-z0-9_-]{11}$/);
  if (bare) return input;

  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /shorts\/([A-Za-z0-9_-]{11})/,
    /embed\/([A-Za-z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/** Best-effort title lookup (only when a Data API key is available). */
async function fetchVideoTitles(ids: string[]): Promise<Record<string, string>> {
  const key = process.env.YOUTUBE_DATA_API_KEY;
  const titles: Record<string, string> = {};
  if (!key || ids.length === 0) return titles;

  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url =
      `${YOUTUBE_DATA_API_URL}/videos?` +
      new URLSearchParams({
        part: "snippet",
        id: batch.join(","),
        key,
      }).toString();

    const response = await fetch(url);
    if (!response.ok) continue;

    const data = await response.json();
    for (const item of data.items ?? []) {
      titles[item.id] = item.snippet?.title ?? item.id;
    }
  }

  return titles;
}

export interface LoadTranscriptsResult {
  transcripts: VideoTranscript[];
  cachedCount: number;
  fetchedCount: number;
  failedVideoIds: string[];
}

/**
 * Fetch (or load from cache) the timestamped transcript for every video, and
 * persist each one to disk as JSON (exact) and Markdown (human-readable).
 */
export async function loadTranscripts(
  videos: YoutubeVideo[],
  config: CliConfig
): Promise<LoadTranscriptsResult> {
  await fs.mkdir(config.cacheDir, { recursive: true });

  let cachedCount = 0;
  let fetchedCount = 0;
  const failedVideoIds: string[] = [];

  const transcripts = await mapLimit(videos, 5, async (video) => {
    const cached = config.useCache
      ? await readCachedTranscript(config.cacheDir, video.videoId)
      : null;

    if (cached) {
      cachedCount++;
      return cached;
    }

    try {
      const cues = await YoutubeService.getTimedTranscript(video.videoId);
      if (cues.length === 0) {
        failedVideoIds.push(video.videoId);
        return null;
      }

      const transcript: VideoTranscript = {
        videoId: video.videoId,
        title: video.title,
        channelId: video.channelId,
        publishedAt: video.publishedAt,
        cues,
      };

      await writeTranscript(config.cacheDir, transcript);
      fetchedCount++;
      return transcript;
    } catch {
      failedVideoIds.push(video.videoId);
      return null;
    }
  });

  return {
    transcripts: transcripts.filter((t): t is VideoTranscript => t !== null),
    cachedCount,
    fetchedCount,
    failedVideoIds,
  };
}

async function readCachedTranscript(
  cacheDir: string,
  videoId: string
): Promise<VideoTranscript | null> {
  try {
    const raw = await fs.readFile(
      path.join(cacheDir, `${videoId}.json`),
      "utf8"
    );
    return JSON.parse(raw) as VideoTranscript;
  } catch {
    return null;
  }
}

async function writeTranscript(
  cacheDir: string,
  transcript: VideoTranscript
): Promise<void> {
  const base = path.join(cacheDir, transcript.videoId);
  await fs.writeFile(`${base}.json`, JSON.stringify(transcript, null, 2));
  await fs.writeFile(`${base}.md`, transcriptToMarkdown(transcript));
}

function transcriptToMarkdown(transcript: VideoTranscript): string {
  const header =
    `# ${transcript.title}\n\n` +
    `https://www.youtube.com/watch?v=${transcript.videoId}\n\n`;

  const body = transcript.cues
    .map((cue) => `[${formatTimestamp(cue.start)}] ${cue.text}`)
    .join("\n");

  return `${header}${body}\n`;
}
