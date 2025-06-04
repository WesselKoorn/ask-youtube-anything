import { getQuestionDetails } from "@api/faq";
import FAQDetail from "@components/faq/faq-detail";
import { notFound } from "next/navigation";

interface FAQDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function FAQDetailPage({ params }: FAQDetailPageProps) {
  try {
    const { id } = await params;

    const { question, relatedQuestions, originalComments } = await getQuestionDetails(id);

    return (
      <div className="container mx-auto px-4 py-8">
        <FAQDetail 
          question={question} 
          relatedQuestions={relatedQuestions} 
          originalComments={originalComments}
        />
      </div>
    );
  } catch (error) {
    notFound();
  }
}
