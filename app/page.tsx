"use client";

import { useState } from "react";
import styles from "./page.module.scss";
import { getLast10Videos } from "@api/youtube";
import { YoutubeVideoModel } from "@models/youtube-video-model";
import { uploadVideos } from "@api/pinecone";

export default function Home() {
  const [videos, setVideos] = useState<YoutubeVideoModel[]>([]);
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <p>https://www.youtube.com/@AlexHormozi/featured</p>
        <form
          action={async (formData: FormData) => {
            try {
              const videos = await getLast10Videos(formData);
              console.log("Videos:", videos);

              setVideos(videos);

              await uploadVideos(videos);
            } catch (error) {
              console.error("Error:", error);
            }
          }}
        >
          <input type="text" name="channelUrl" />
          <button type="submit">Get Videos</button>
        </form>

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
