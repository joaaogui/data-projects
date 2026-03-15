import { YouTubeIcon } from "@/components/youtube-icon";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page Not Found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md animate-scale-in">
        <div className="flex justify-center">
          <div className="rounded-full bg-muted p-5">
            <YouTubeIcon className="h-12 w-12 text-muted-foreground" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">404</h1>
          <p className="text-lg text-muted-foreground">
            This page doesn&apos;t exist or has been moved.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Analyze a Channel
          </Link>
        </div>
        <p className="text-xs text-muted-foreground/60">
          Try searching for a YouTube channel on the{" "}
          <Link href="/" className="text-primary hover:underline">
            homepage
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
