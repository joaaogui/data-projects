import { SiteNav } from "@/components/site-nav";
import { Providers } from "@data-projects/ui";
import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://lastfm.joaog.space";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Listening Habits",
    template: "%s | Listening Habits",
  },
  description:
    "Deep analysis of a Last.fm scrobble history: temporal patterns, artist discovery, obsessions, and how taste evolves over a decade.",
  // Reachable by anyone with the URL, but deliberately kept out of search
  // results: the pages are one person's listening history, not a public tool.
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    type: "website",
    siteName: "Listening Habits",
    title: "Listening Habits",
    description:
      "A decade of Last.fm scrobbles: when the listening happens, how artists enter and leave rotation, and how taste concentration shifts.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased min-h-dvh">
        <Providers>
          <a
            href="#main-content"
            className="fixed left-3 top-3 z-[100] -translate-y-16 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-transform focus:translate-y-0"
          >
            Skip to content
          </a>
          <SiteNav />
          <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
