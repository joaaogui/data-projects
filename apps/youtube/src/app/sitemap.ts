import { db } from "@/db";
import { channels } from "@/db/schema";
import { desc } from "drizzle-orm";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://youtube.joaog.space";

  const channelRows = await db
    .select({ id: channels.id, fetchedAt: channels.fetchedAt })
    .from(channels)
    .orderBy(desc(channels.fetchedAt))
    .limit(1000);

  const channelEntries: MetadataRoute.Sitemap = channelRows.map((ch) => ({
    url: `${baseUrl}/channel/${ch.id}`,
    lastModified: ch.fetchedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/compare`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
    ...channelEntries,
  ];
}
