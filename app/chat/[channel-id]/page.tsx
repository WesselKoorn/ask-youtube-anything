import PageContent from "@components/page-content";
import Chat from "./chat";
import { YoutubeService } from "@api/services/youtube-service";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ "channel-id": string }>;
}) {
  const channelId = (await params)["channel-id"];

  const channelName = await YoutubeService.getChannelName(channelId);

  return (
    <PageContent>
      <Chat channelId={channelId} channelName={channelName} />
    </PageContent>
  );
}
