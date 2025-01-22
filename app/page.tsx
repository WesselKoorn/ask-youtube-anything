"use client";

import { useState } from "react";
import styles from "./page.module.scss";
import { getChannelId, getLast10Videos } from "@api/youtube";
import { askQuestion, uploadVideos } from "@api/pinecone";
import { ChatbotAnswer } from "@models/chatbot-answer";
import { getAnswer } from "@api/chatbot";

export default function Home() {
  const [channelId, setChannelId] = useState<string>("");
  const [answer, setAnswer] = useState<ChatbotAnswer | null>(null);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <p>https://www.youtube.com/@AlexHormozi/featured</p>
        <form
          action={async (formData: FormData) => {
            try {
              const channelId = await getChannelId(formData);

              const videos = await getLast10Videos(channelId);
              console.log("Videos:", videos);

              await uploadVideos(videos);

              setChannelId(channelId);
            } catch (error) {
              console.error("Error:", error);
            }
          }}
        >
          <input type="text" name="channelUrl" />
          <button type="submit">Get Videos</button>
        </form>

        {channelId && (
          <form
            action={async (formData: FormData) => {
              try {
                const question = formData.get("question") as string;

                if (!question) {
                  throw new Error("Question is required");
                }

                const searchResults = await askQuestion(channelId, question);
                const answer = await getAnswer(question, searchResults);

                setAnswer(answer);
              } catch (error) {
                console.error("Error:", error);
              }
            }}
          >
            <input type="text" name="question" />
            <button type="submit">Ask question</button>
          </form>
        )}

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
