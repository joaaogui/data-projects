import { db } from "@/db";
import { channels } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://youtube.joaog.space";

interface Props {
  params: Promise<{ channelId: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { channelId } = await params;
  const result = await db
    .select()
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);
  const channel = result[0];

  if (!channel) {
    return {
      title: "Channel Not Found",
      robots: { index: false, follow: false },
    };
  }

  const title = channel.title;
  const description = `Analyze ${title}'s YouTube video performance — engagement rates, view trends, content scoring, and AI-powered insights.`;
  const canonicalUrl = `${SITE_URL}/channel/${channelId}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${title} – YouTube Channel Analysis`,
      description,
      url: canonicalUrl,
      type: "website",
      ...(channel.thumbnailUrl && {
        images: [{ url: channel.thumbnailUrl, alt: title }],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} – YouTube Analyzer`,
      description,
    },
  };
}

function ChannelJsonLd({
  channelId,
  title,
}: Readonly<{
  channelId: string;
  title: string;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "YouTube Analyzer",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: title,
        item: `${SITE_URL}/channel/${channelId}`,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default async function ChannelLayout({ params, children }: Readonly<Props>) {
  const { channelId } = await params;
  const result = await db
    .select()
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);
  const channel = result[0];

  return (
    <>
      {channel && (
        <ChannelJsonLd channelId={channelId} title={channel.title} />
      )}
      {children}
    </>
  );
}
