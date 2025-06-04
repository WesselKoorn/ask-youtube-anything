import Link from "next/link";
import styles from "./original-comments.module.scss";
import { YoutubeComment } from "@models/youtube-comment";

interface OriginalCommentsProps {
  comments: YoutubeComment[];
}

export default function OriginalComments({ comments }: OriginalCommentsProps) {
  if (comments.length === 0) {
    return null;
  }

  return (
    <div className={styles.commentsSection}>
      <h2 className={styles.title}>Original Comments</h2>
      <div className={styles.commentsList}>
        {comments.map((comment) => (
          <div key={comment.id} className={styles.comment}>
            <div className={styles.commentContent}>{comment.content}</div>
            <div className={styles.metadata}>
              <span className={styles.author}>by {comment.author}</span>
              <span className={styles.date}>
                {new Date(comment.published_at).toLocaleDateString()}
              </span>
              <Link
                href={`https://youtube.com/watch?v=${comment.video_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.videoLink}
              >
                View on YouTube
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 