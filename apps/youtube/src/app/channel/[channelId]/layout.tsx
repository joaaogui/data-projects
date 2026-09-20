import { db } from "@/db";
import { channels, videos } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import type { Metadata } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://youtube.joaog.space";

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

  const [videoStats] = await db
    .select({ analyzedCount: count() })
    .from(videos)
    .where(eq(videos.channelId, channelId));

  const analyzedCount = videoStats?.analyzedCount ?? 0;
  const description =
    analyzedCount > 0
      ? `Analytics and insights for ${channel.title}'s YouTube channel. ${analyzedCount} videos analyzed.`
      : `Analytics and insights for ${channel.title}'s YouTube channel.`;
  const fullTitle = `${channel.title} | YouTube Analyzer`;
  const canonicalPath = `/channel/${channelId}`;
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;

  return {
    title: channel.title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: fullTitle,
      description,
      type: "website",
      url: canonicalUrl,
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
