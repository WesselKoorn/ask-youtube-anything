"use client";

import styles from "./transcript-form.module.scss";

import { useState } from "react";
import { getVideoTranscript } from "@api/youtube";
import { TranscriptSegment } from "@models/transcript-segment";
import SubmitButton from "@components/submit-button";

/**
 * Format a millisecond offset as m:ss (or h:mm:ss for longer videos).
 */
function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const paddedSeconds = String(seconds).padStart(2, "0");

  if (hours > 0) {
    const paddedMinutes = String(minutes).padStart(2, "0");
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${minutes}:${paddedSeconds}`;
}

export default function TranscriptForm() {
  const [segments, setSegments] = useState<TranscriptSegment[] | null>(null);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    try {
      setError(null);
      setSegments(null);

      const videoUrl = formData.get("videoUrl") as string;

      if (!videoUrl) {
        throw new Error("Video URL is required");
      }

      const result = await getVideoTranscript(videoUrl);

      setSegments(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const plainText = segments?.map((segment) => segment.text).join(" ") ?? "";
  const timestampedText =
    segments
      ?.map((segment) => `${formatTimestamp(segment.offset)}  ${segment.text}`)
      .join("\n") ?? "";

  async function handleCopy() {
    if (!segments) return;

    await navigator.clipboard.writeText(
      showTimestamps ? timestampedText : plainText
    );
  }

  return (
    <div className={styles.component}>
      <p className={styles.description}>
        Paste the URL of a YouTube video to get its full transcript (e.g.
        https://www.youtube.com/watch?v=IcrbM1l_BoI)
      </p>
      <form className={styles.form} action={handleSubmit}>
        <input
          className={styles.input}
          type="text"
          name="videoUrl"
          placeholder="Enter a YouTube video URL"
        />
        <SubmitButton />
      </form>

      {error && (
        <p role="alert" className={`error`}>
          {error}
        </p>
      )}

      {segments && (
        <div className={styles.result}>
          <div className={styles.resultHeader}>
            <p className={styles.resultTitle}>Transcript</p>
            <div className={styles.actions}>
              <div className={styles.toggle} role="group">
                <button
                  type="button"
                  className={!showTimestamps ? styles.toggleActive : ""}
                  onClick={() => setShowTimestamps(false)}
                >
                  Plain
                </button>
                <button
                  type="button"
                  className={showTimestamps ? styles.toggleActive : ""}
                  onClick={() => setShowTimestamps(true)}
                >
                  Timestamps
                </button>
              </div>
              <button
                type="button"
                className={styles.copyButton}
                onClick={handleCopy}
              >
                Copy
              </button>
            </div>
          </div>

          {showTimestamps ? (
            <ol className={styles.segments}>
              {segments.map((segment, index) => (
                <li key={index} className={styles.segment}>
                  <span className={styles.timestamp}>
                    {formatTimestamp(segment.offset)}
                  </span>
                  <span>{segment.text}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.transcript}>{plainText}</p>
          )}
        </div>
      )}
    </div>
  );
}
