"use client";

import styles from "./analyze-channel-form.module.scss";

import { analyzeChannel } from "app/actions";
import { useFormStatus } from "react-dom";
import { useState } from "react";

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

  function SubmitButton() {
    const { pending } = useFormStatus();

    return (
      <button type="submit" disabled={pending}>
        {pending ? "Analyzing..." : "Get Videos"}
      </button>
    );
  }

  return (
    <div className={styles.component}>
      <form className={styles.form} action={handleSubmit}>
        <input type="text" name="channelUrl" />
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
