import Link from "next/link";
import { FAQQuestion } from "@models/faq-question";

interface FAQDetailProps {
  question: FAQQuestion;
  relatedQuestions: FAQQuestion[];
}

export default function FAQDetail({ question, relatedQuestions }: FAQDetailProps) {
  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {question.canonicalQuestion}
          </h1>
          <Link
            href="/faq"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            ← Back to FAQs
          </Link>
        </div>
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <span>Asked {question.frequency} times</span>
          <span>
            Last updated {new Date(question.lastUpdated).toLocaleDateString()}
          </span>
        </div>
      </div>

      {relatedQuestions.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Related Questions</h2>
          <div className="space-y-4">
            {relatedQuestions.map((relatedQuestion) => (
              <Link
                key={relatedQuestion.id}
                href={`/faq/${relatedQuestion.id}`}
                className="block p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-medium text-gray-900">
                    {relatedQuestion.canonicalQuestion}
                  </h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
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