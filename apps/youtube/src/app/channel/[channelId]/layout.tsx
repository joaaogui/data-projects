import { db } from "@/db";
import { channels } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ channelId: string }>;
}): Promise<Metadata> {
  const { channelId } = await params;
  const [channel] = await db
    .select()
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  if (!channel) {
    return { title: "Channel Not Found" };
  }

  const description = `Analytics and insights for ${channel.title}'s YouTube channel. ${channel.videoCount ?? 0} videos analyzed.`;
  const fullTitle = `${channel.title} | YouTube Analyzer`;

  return {
    title: channel.title,
    description,
    openGraph: {
      title: fullTitle,
      description,
      type: "website",
      url: `https://youtube.joaog.space/channel/${channelId}`,
      images: channel.thumbnailUrl
        ? [{ url: channel.thumbnailUrl, width: 800, height: 800 }]
        : [],
    },
    twitter: {
      card: "summary",
      title: fullTitle,
      description,
    },
  };
}

export default function ChannelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
