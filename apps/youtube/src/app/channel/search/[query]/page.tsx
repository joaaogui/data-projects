"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, Skeleton, Button, Navbar } from "@data-projects/ui";
import { SearchChannel } from "@/components/search-channel";
import { useChannelSearch } from "@/hooks/use-channel-search";
import { AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

function YouTubeIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

function YouTubeLogo() {
  return <YouTubeIcon className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />;
}

export default function SearchChannelPage() {
  const params = useParams();
  const router = useRouter();
  const query = decodeURIComponent(params.query as string);

  const {
    data: channelInfo,
    isLoading,
    error,
  } = useChannelSearch(query);

  useEffect(() => {
    if (channelInfo?.channelId) {
      router.replace(`/channel/${channelInfo.channelId}`);
    }
  }, [channelInfo, router]);

  if (error) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <Navbar
          homeLink={<Link href="/" />}
          logo={<YouTubeLogo />}
          appName="YouTube Analyzer"
          search={<SearchChannel initialValue={query} compact />}
          themeIconClassName="text-primary"
        />
        <main className="flex-1 min-h-0 container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <div className="rounded-full bg-destructive/10 p-4 mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Channel Not Found</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              We couldn&apos;t find a YouTube channel called &quot;{query}&quot;. Please try a different search.
            </p>
            <Button asChild>
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar
        homeLink={<Link href="/" />}
        logo={<YouTubeLogo />}
        appName="YouTube Analyzer"
        search={<SearchChannel initialValue={query} compact />}
        themeIconClassName="text-primary"
      />

      <main className="flex-1 min-h-0 container mx-auto px-4 py-6 flex flex-col overflow-hidden">
        {isLoading && (
          <Card className="mb-6 flex-shrink-0">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}


