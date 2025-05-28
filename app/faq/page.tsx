import { getChannelFAQs } from "@api/faq";
import { FAQFilter } from "@models/faq-filter";
import FAQList from "@components/faq/faq-list";
import FAQFilters from "@components/faq/faq-filters";

export default async function FAQPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { videoId, startDate, endDate, searchQuery, minFrequency } =
    await searchParams;

  const filter: FAQFilter = {
    videoId: videoId as string,
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined,
    searchQuery: searchQuery as string,
    minFrequency: minFrequency ? parseInt(minFrequency as string) : undefined,
  };

  const faqs = await getChannelFAQs(filter);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Frequently Asked Questions</h1>
      <FAQFilters />
      <FAQList faqs={faqs} />
    </div>
  );
}
