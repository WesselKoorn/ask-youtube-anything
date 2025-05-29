import Link from "next/link";
import { FAQQuestion } from "@models/faq-question";
import styles from "./faq-detail.module.scss";

interface FAQDetailProps {
  question: FAQQuestion;
  relatedQuestions: FAQQuestion[];
}

export default function FAQDetail({ question, relatedQuestions }: FAQDetailProps) {
  return (
    <div className={styles.detail}>
      <div className={styles.mainQuestion}>
        <div className={styles.header}>
          <h1 className={styles.title}>{question.canonicalQuestion}</h1>
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
                    {relatedQuestion.canonicalQuestion}
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