"use client";

import styles from "./chat.module.scss";

import { useState } from "react";
import { askQuestion } from "@api/pinecone";
import { ChatbotAnswer } from "@models/chatbot-answer";
import { getAnswer } from "@api/chatbot";
import SubmitButton from "@components/submit-button";

interface ChatProps {
  channelId: string;
  channelName: string;
}

export default function Chat({ channelId, channelName }: ChatProps) {
  const [messages, setMessages] = useState<(ChatbotAnswer | string)[]>([]);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={styles.component}>
      <div className={styles.header}>
        <h1>Ask {channelName} Anything</h1>
      </div>
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
