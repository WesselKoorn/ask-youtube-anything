"use client";

import styles from "./chat.module.scss";

import { useState } from "react";
import { askQuestion } from "@api/pinecone";
import { ChatbotAnswer } from "@models/chatbot-answer";
import { getAnswer } from "@api/chatbot";
import { useFormStatus } from "react-dom";

interface ChatProps {
  channelId: string;
}

export default function Chat({ channelId }: ChatProps) {
  const [answer, setAnswer] = useState<ChatbotAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);

  function SubmitButton() {
    const { pending } = useFormStatus();

    return (
      <button type="submit" disabled={pending}>
        {pending ? "Thinking..." : "Ask question"}
      </button>
    );
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <form
          action={async (formData: FormData) => {
            try {
              setError(null);
              const question = formData.get("question") as string;

              if (!question) {
                throw new Error("Question is required");
              }

              const searchResults = await askQuestion(channelId, question);

              const answer = await getAnswer(question, searchResults);

              setAnswer(answer);
            } catch (error) {
              console.error("Error:", error);

              setError(
                error instanceof Error ? error.message : "An error occurred"
              );
            }
          }}
        >
          <input type="text" name="question" />
          <SubmitButton />
        </form>

        {error && <p className={styles.error}>{error}</p>}

        {answer && (
          <div className={styles.answerContainer}>
            <p className={styles.answer}>{answer.answer}</p>

            <p>References:</p>
            <ul>
              {answer.references.map((reference) => (
                <li key={reference.videoId}>
                  <a href={reference.link} target="_blank">
                    {reference.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
