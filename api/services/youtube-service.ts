import { execFile } from "child_process";
import { constants as fsConstants, promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

import { TranscriptCue } from "@models/transcript";
import { YoutubeVideo } from "@models/youtube-video";

const execFileAsync = promisify(execFile);

const YOUTUBE_DATA_API_URL = "https://youtube.googleapis.com/youtube/v3";
const YOUTUBE_DATA_API_KEY = process.env.YOUTUBE_DATA_API_KEY || "";

export class YoutubeService {
  /**
   * Extract the handle from a URL like: https://www.youtube.com/@AlexHormozi/featured
   * Returns "AlexHormozi" in this example.
   */
  static extractHandleFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);

      // Typical handle pattern: /@Handle
      // e.g. pathname might be "/@AlexHormozi/featured"
      const pathParts = urlObj.pathname.split("/");

      // Find the part that starts with "@"
      const handlePart = pathParts.find((part) => part.startsWith("@"));

      if (!handlePart) return null;

      // Remove the "@" symbol
      return handlePart.replace("@", "");
    } catch (error) {
      console.error(error);

      return null; // Invalid URL or unexpected format
    }
  }

  /**
   * Use the YouTube "search" endpoint to find a channelId from a given handle.
   * This approach uses "type=channel&q={handle}" to locate the channel.
   */
  static async getChannelId(channelName: string): Promise<string> {
    // TODO: Search is an expensive call, see if we can omit it.
    const searchResponse = await fetch(
      `${YOUTUBE_DATA_API_URL}/search?` +
        new URLSearchParams({
          part: "snippet", // was "id"
          q: channelName,
          type: "channel",
          maxResults: "1",
          key: YOUTUBE_DATA_API_KEY,
        }).toString()
    );

    if (!searchResponse.ok) {
      throw new Error("Failed to fetch channel ID");
    }

    const searchData = await searchResponse.json();

    if (!searchData.items || searchData.items.length === 0) {
      throw new Error("No channel found");
    }

    return searchData.items[0].id.channelId;
  }

  /**
   * From the channelId, get the "uploads" playlist ID via the Channels API.
   */
  static async getUploadsPlaylistId(channelId: string): Promise<string | null> {
    const channelResponse = await fetch(
      `${YOUTUBE_DATA_API_URL}/channels?` +
        new URLSearchParams({
          part: "contentDetails",
          id: channelId,
          key: YOUTUBE_DATA_API_KEY,
        }).toString()
    );

    if (!channelResponse.ok) {
      console.error(
        `YouTube channels API error: ${channelResponse.status} ${channelResponse.statusText}`
      );

      throw new Error("Failed to fetch channel ID");
    }

    const data = await channelResponse.json();
    const channel = data.items?.[0];

    if (!channel?.contentDetails?.relatedPlaylists?.uploads) {
      throw new Error("No uploads playlist found");
    }

    return channel.contentDetails.relatedPlaylists.uploads;
  }

  /**
   * Fetch up to 'maxResults' videos from an 'uploads' playlist via the PlaylistItems API.
   */
  static async fetchPlaylistVideos(
    playlistId: string,
    maxResults: number
  ): Promise<YoutubeVideo[]> {
    const playlistResponse = await fetch(
      `${YOUTUBE_DATA_API_URL}/playlistItems?` +
        new URLSearchParams({
          part: "snippet",
          playlistId: playlistId,
          maxResults: maxResults.toString(),
          key: YOUTUBE_DATA_API_KEY,
        }).toString()
    );

    if (!playlistResponse.ok) {
      console.error(
        `YouTube playlistItems API error: ${playlistResponse.status} ${playlistResponse.statusText}`
      );

      throw new Error("Failed to fetch playlist videos");
    }

    const data = await playlistResponse.json();

    const videos: YoutubeVideo[] =
      data.items?.map(
        (item: {
          id: string;
          snippet: {
            title: string;
            description: string;
            thumbnails: {
              high: { url: string };
            };
            publishedAt: string;
            channelId: string;
            resourceId: {
              videoId: string;
            };
          };
        }) => {
          const video: YoutubeVideo = {
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnailUrl: item.snippet.thumbnails.high.url,
            publishedAt: item.snippet.publishedAt,
            videoId: item.snippet.resourceId.videoId,
            channelId: item.snippet.channelId,
          };

          return video;
        }
      ) ?? [];

    return videos;
  }

  static async getTranscriptions(videoIds: string[]): Promise<
    {
      videoId: string;
      transcription: string | undefined;
    }[]
  > {
    const transcriptions = await Promise.allSettled(
      videoIds.map(async (videoId) => {
        return {
          videoId,
          transcription: await this.getTranscript(videoId),
        };
      })
    );

    const results = transcriptions
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    return results;
  }

  static async getTranscript(videoId: string): Promise<string> {
    const cues = await this.getTimedTranscript(videoId);

    return cues.map((cue) => cue.text).join(" ");
  }

  /**
   * Like getTranscript, but preserves per-cue timestamps (in seconds).
   *
   * Captions are pulled with yt-dlp in YouTube's `json3` timedtext format,
   * which carries exact per-cue start/duration (in ms) — the timestamps that
   * make it possible to deep-link to, and later clip, the precise moment an
   * answer is given. (The previous `youtube-transcript` scraper stopped working
   * against YouTube's current caption endpoint and returned zero cues.)
   *
   * Returns an empty array when the video has no English captions (the caller
   * counts it as unavailable); throws only when yt-dlp itself is missing.
   */
  static async getTimedTranscript(videoId: string): Promise<TranscriptCue[]> {
    const bin = await resolveYtDlpBin();
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `ytcc-${videoId}-`));

    try {
      await execFileAsync(
        bin,
        [
          "--skip-download",
          "--no-warnings",
          "--write-subs",
          "--write-auto-subs",
          "--sub-langs",
          "en.*,en-orig",
          "--sub-format",
          "json3",
          "-o",
          path.join(tmpDir, "%(id)s.%(ext)s"),
          "--",
          videoId,
        ],
        { maxBuffer: 64 * 1024 * 1024 }
      );

      const files = (await fs.readdir(tmpDir)).filter((f) =>
        f.endsWith(".json3")
      );
      if (files.length === 0) return [];

      const raw = await fs.readFile(
        path.join(tmpDir, pickEnglishSub(files)),
        "utf8"
      );
      return parseJson3Cues(raw);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new Error(
          "yt-dlp not found — it is required to fetch timestamped transcripts. " +
            "Install it (e.g. `brew install yt-dlp`) or set YT_DLP_PATH to its path."
        );
      }
      // Video unavailable / no captions / transient yt-dlp error → no cues.
      return [];
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }

  /**
   * Batch variant of getTimedTranscript. Resolves only the videos whose
   * transcripts could be fetched (failures are dropped, mirroring
   * getTranscriptions).
   */
  static async getTimedTranscriptions(
    videoIds: string[]
  ): Promise<{ videoId: string; cues: TranscriptCue[] }[]> {
    const results = await Promise.allSettled(
      videoIds.map(async (videoId) => ({
        videoId,
        cues: await this.getTimedTranscript(videoId),
      }))
    );

    return results
      .filter(
        (
          result
        ): result is PromiseFulfilledResult<{
          videoId: string;
          cues: TranscriptCue[];
        }> => result.status === "fulfilled"
      )
      .map((result) => result.value);
  }

  /**
   * Get the channel name from a channel ID using the YouTube Data API
   */
  static async getChannelName(channelId: string): Promise<string> {
    try {
      const channelResponse = await fetch(
        `${YOUTUBE_DATA_API_URL}/channels?` +
          new URLSearchParams({
            part: "snippet",
            id: channelId,
            key: YOUTUBE_DATA_API_KEY,
          }).toString()
      );

      if (!channelResponse.ok) {
        console.error(
          `YouTube channels API error: ${channelResponse.status} ${channelResponse.statusText}`
        );

        throw new Error("Failed to fetch channel name");
      }

      const data = await channelResponse.json();
      const channel = data.items?.[0];

      if (!channel?.snippet?.title) {
        throw new Error("Channel not found");
      }

      return channel.snippet.title;
    } catch (error) {
      console.error(error);

      return "";
    }
  }
}

/** Cached path to the yt-dlp binary once resolved. */
let cachedYtDlpBin: string | null = null;

/**
 * Locate a yt-dlp binary: honor $YT_DLP_PATH, then common install locations,
 * then fall back to "yt-dlp" on PATH.
 */
async function resolveYtDlpBin(): Promise<string> {
  if (cachedYtDlpBin) return cachedYtDlpBin;

  const candidates = [
    process.env.YT_DLP_PATH,
    path.join(os.homedir(), ".local", "bin", "yt-dlp"),
    "/opt/homebrew/bin/yt-dlp",
    "/usr/local/bin/yt-dlp",
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      await fs.access(candidate, fsConstants.X_OK);
      cachedYtDlpBin = candidate;
      return candidate;
    } catch {
      // not here — try the next candidate
    }
  }

  cachedYtDlpBin = "yt-dlp"; // rely on PATH
  return cachedYtDlpBin;
}

/** Prefer a manual/auto English track, in a stable order. */
function pickEnglishSub(files: string[]): string {
  return (
    files.find((f) => /\.en\.json3$/.test(f)) ??
    files.find((f) => /\.en-orig\.json3$/.test(f)) ??
    files.find((f) => /\.en[-.]/.test(f)) ??
    files[0]
  );
}

interface Json3Event {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: { utf8?: string }[];
}

/**
 * Parse YouTube `json3` timedtext into {start, duration, text} cues (seconds).
 * Skips window-definition events (no segs) and the blank "\n" append events
 * that auto-captions emit for their rolling-scroll effect.
 */
function parseJson3Cues(raw: string): TranscriptCue[] {
  let data: { events?: Json3Event[] };
  try {
    data = JSON.parse(raw) as { events?: Json3Event[] };
  } catch {
    return [];
  }

  const cues: TranscriptCue[] = [];
  for (const event of data.events ?? []) {
    if (!event.segs) continue;
    const text = event.segs
      .map((seg) => seg.utf8 ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;

    cues.push({
      start: (event.tStartMs ?? 0) / 1000,
      duration: Math.max(0, (event.dDurationMs ?? 0) / 1000),
      text,
    });
  }

  return cues;
}
