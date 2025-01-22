"use client";

import styles from "./chat.module.scss";

import { useState } from "react";
import { askQuestion } from "@api/pinecone";
import { ChatbotAnswer } from "@models/chatbot-answer";
import { getAnswer } from "@api/chatbot";
import { useFormStatus } from "react-dom";
import Spinner from "@components/spinner";

interface ChatProps {
  channelId: string;
  channelName: string;
}

export default function Chat({ channelId, channelName }: ChatProps) {
  const [messages, setMessages] = useState<(ChatbotAnswer | string)[]>([]);
  const [error, setError] = useState<string | null>(null);

  function SubmitButton() {
    const { pending } = useFormStatus();

    return (
      <button className={styles.submitButton} type="submit" disabled={pending}>
        {pending ? (
          <Spinner />
        ) : (
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M15.1918 8.90615C15.6381 8.45983 16.3618 8.45983 16.8081 8.90615L21.9509 14.049C22.3972 14.4953 22.3972 15.2189 21.9509 15.6652C21.5046 16.1116 20.781 16.1116 20.3347 15.6652L17.1428 12.4734V22.2857C17.1428 22.9169 16.6311 23.4286 15.9999 23.4286C15.3688 23.4286 14.8571 22.9169 14.8571 22.2857V12.4734L11.6652 15.6652C11.2189 16.1116 10.4953 16.1116 10.049 15.6652C9.60265 15.2189 9.60265 14.4953 10.049 14.049L15.1918 8.90615Z"
              fill="currentColor"
            ></path>
          </svg>
        )}
      </button>
    );
  }

  return (
    <div className={styles.component}>
      <div className={styles.header}>
        <h1>Ask {channelName} Anything</h1>
      </div>
      {messages.length > 0 && (
        <div className={styles.messages}>
          <div className={styles.messagesInner}>
            {messages.map((message, index) =>
              typeof message === "string" ? (
                <p key={index} className={styles.userMessage}>
                  {message}
                </p>
              ) : (
                <div key={index} className={styles.chatbotMessage}>
                  <p className={styles.answer}>{message.answer}</p>
                  <p className={styles.referencesTitle}>References:</p>
                  <ul className={styles.references}>
                    {message.references.map((reference) => (
                      <li key={reference.videoId}>
                        <a href={reference.link} target="_blank">
                          🔗 {reference.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )}
          </div>
        </div>
      )}

      <form
        className={styles.form}
        action={async (formData: FormData) => {
          try {
            setError(null);

            const question = formData.get("question") as string;

            if (!question) {
              throw new Error("Question is required");
            }

            setMessages((prev) => [...prev, question]);

            const searchResults = await askQuestion(channelId, question);
            const answer = await getAnswer(question, searchResults);

            setMessages((prev) => [...prev, answer]);
          } catch (error) {
            console.error("Error:", error);

            setError(
              error instanceof Error ? error.message : "An error occurred"
            );
          }
        }}
      >
        <input
          className={styles.input}
          type="text"
          name="question"
          placeholder="Ask YouTube anything"
        />
        <SubmitButton />
      </form>

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
