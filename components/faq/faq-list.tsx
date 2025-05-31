import Link from "next/link";
import { FAQQuestion } from "@models/faq-question";
import styles from "./faq-list.module.scss";

interface FAQListProps {
  faqs: FAQQuestion[];
}

export default function FAQList({ faqs }: FAQListProps) {
  if (faqs.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No FAQs found. Try adjusting your filters.</p>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {faqs.map((faq) => (
        <Link key={faq.id} href={`/faq/${faq.id}`} className={styles.questionItem}>
          <div className={styles.questionHeader}>
            <h3 className={styles.questionTitle}>{faq.canonical_question}</h3>
          </div>
          <div className={styles.metadata}>
            <span>Asked {faq.frequency} times</span>
            <span>
              Last updated {new Date(faq.lastUpdated).toLocaleDateString()}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
} 