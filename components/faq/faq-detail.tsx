import Link from "next/link";
import { FAQQuestion } from "@models/faq-question";
import { YoutubeComment } from "@models/youtube-comment";
import styles from "./faq-detail.module.scss";
import OriginalComments from "./original-comments";

interface FAQDetailProps {
  question: FAQQuestion;
  relatedQuestions: FAQQuestion[];
  originalComments: YoutubeComment[];
}

export default function FAQDetail({ question, relatedQuestions, originalComments }: FAQDetailProps) {
  return (
    <div className={styles.detail}>
      <div className={styles.mainQuestion}>
        <div className={styles.header}>
          <h1 className={styles.title}>{question.canonical_question}</h1>
          <Link href="/faq" className={styles.backLink}>
            ← Back to FAQs
          </Link>
        </div>
        <div className={styles.metadata}>
          <span>Asked {question.frequency} times</span>
          <span>
            Last updated {new Date(question.lastUpdated).toLocaleDateString()}
          </span>
        </div>
      </div>

      <OriginalComments comments={originalComments} />

      {relatedQuestions.length > 0 && (
        <div className={styles.relatedSection}>
          <h2 className={styles.relatedTitle}>Related Questions</h2>
          <div className={styles.relatedList}>
            {relatedQuestions.map((relatedQuestion) => (
              <Link
                key={relatedQuestion.id}
                href={`/faq/${relatedQuestion.id}`}
                className={styles.relatedItem}
              >
                <div className={styles.relatedHeader}>
                  <h3 className={styles.relatedQuestion}>
                    {relatedQuestion.canonical_question}
                  </h3>
                  <div className={styles.metadata}>
                    <span>Asked {relatedQuestion.frequency} times</span>
                    <span>
                      Last updated{" "}
                      {new Date(relatedQuestion.lastUpdated).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 