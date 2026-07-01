"use client";

import styles from "./transcript-form.module.scss";

import { useState } from "react";
import { getVideoTranscript } from "@api/youtube";
import SubmitButton from "@components/submit-button";

export default function TranscriptForm() {
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    try {
      setError(null);
      setTranscript(null);

      const videoUrl = formData.get("videoUrl") as string;

      if (!videoUrl) {
        throw new Error("Video URL is required");
      }

      const result = await getVideoTranscript(videoUrl);

      setTranscript(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleCopy() {
    if (!transcript) return;

    await navigator.clipboard.writeText(transcript);
  }

  return (
    <div className={styles.component}>
      <p className={styles.description}>
        Paste the URL of a YouTube video to get its full transcript (e.g.
        https://www.youtube.com/watch?v=dQw4w9WgXcQ)
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

      {transcript && (
        <div className={styles.result}>
          <div className={styles.resultHeader}>
            <p className={styles.resultTitle}>Transcript</p>
            <button
              type="button"
              className={styles.copyButton}
              onClick={handleCopy}
            >
              Copy
            </button>
          </div>
          <p className={styles.transcript}>{transcript}</p>
        </div>
      )}
    </div>
  );
}
