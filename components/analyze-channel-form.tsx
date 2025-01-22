"use client";

import styles from "./analyze-channel-form.module.scss";

import { analyzeChannel } from "app/actions";
import { useState } from "react";
import SubmitButton from "@components/submit-button";

export default function AnalyzeChannelForm() {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    try {
      setError(null);

      await analyzeChannel(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className={styles.component}>
      <p className={styles.description}>
        Enter the URL of the YouTube channel you want to analyze (e.g.
        https://www.youtube.com/@AlexHormozi/)
      </p>
      <form className={styles.form} action={handleSubmit}>
        <input
          className={styles.input}
          type="text"
          name="channelUrl"
          placeholder="Enter a YouTube channel URL"
        />
        <SubmitButton />
      </form>
      {error && (
        <p role="alert" className={`error`}>
          {error}
        </p>
      )}
    </div>
  );
}
