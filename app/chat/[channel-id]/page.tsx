import PageContent from "@components/page-content";
import Chat from "./chat";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ "channel-id": string }>;
}) {
  const channelId = (await params)["channel-id"];

  return (
    <PageContent>
      <Chat channelId={channelId} />
    </PageContent>
  );
}
