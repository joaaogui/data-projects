import { db } from "@/db";
import { channels, videos } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://youtube.joaog.space";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const allChannels = await db
    .select({
      id: channels.id,
      fetchedAt: channels.fetchedAt,
      latestVideo: sql<Date>`(
        SELECT MAX(${videos.fetchedAt})
        FROM ${videos}
        WHERE ${videos.channelId} = ${channels.id}
      )`.as("latest_video"),
    })
    .from(channels)
    .orderBy(desc(channels.fetchedAt));

  const channelUrls: MetadataRoute.Sitemap = allChannels.map((ch) => ({
    url: `${SITE_URL}/channel/${ch.id}`,
    lastModified: ch.latestVideo ?? ch.fetchedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...channelUrls,
  ];
}

