import Link from "next/link";
import { FAQQuestion } from "@models/faq-question";

interface FAQListProps {
  faqs: FAQQuestion[];
}

export default function FAQList({ faqs }: FAQListProps) {
  if (faqs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No FAQs found. Try adjusting your filters.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {faqs.map((faq) => (
        <Link
          key={faq.id}
          href={`/faq/${faq.id}`}
          className="block p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <div className="flex justify-between items-start">
            <h2 className="text-xl font-semibold text-gray-900">
              {faq.canonicalQuestion}
            </h2>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>Asked {faq.frequency} times</span>
              <span>
                Last updated{" "}
                {new Date(faq.lastUpdated).toLocaleDateString()}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
} 