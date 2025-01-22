"use client";

import { useState } from "react";
import styles from "./page.module.scss";
import { getChannelId, getLast10Videos } from "@api/youtube";
import { YoutubeVideoModel } from "@models/youtube-video-model";
import { askQuestion, uploadVideos } from "@api/pinecone";

export default function Home() {
  const [channelId, setChannelId] = useState<string>("");
  const [videos, setVideos] = useState<YoutubeVideoModel[]>([]);

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
              setVideos(videos);
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

                await askQuestion(channelId, question);
              } catch (error) {
                console.error("Error:", error);
              }
            }}
          >
            <input type="text" name="question" />
            <button type="submit">Ask question</button>
          </form>
        )}

        <div className={styles.videos}>
          {videos.map((video) => (
            <div key={video.videoId} className={styles.video}>
              <h2>{video.title}</h2>
              <p className={styles.transcription}>{video.transcription}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
