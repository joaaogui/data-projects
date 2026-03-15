import { UserMenu } from "@/components/user-menu";
import { Providers } from "@data-projects/ui";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://youtube.joaog.space";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "YouTube Analyzer - Channel Statistics & Video Performance",
    template: "%s | YouTube Analyzer",
  },
  description:
    "Free tool to analyze YouTube channel statistics, video performance metrics, views, and engagement. Find the best performing videos from any channel.",
  keywords: [
    "youtube analytics",
    "youtube channel analyzer",
    "video performance",
    "channel statistics",
    "youtube metrics",
    "video engagement rate",
    "youtube video score",
    "youtube channel analysis tool",
    "free youtube analytics",
    "video stats tracker",
    "youtube content analysis",
    "youtube AI insights",
  ],
  authors: [{ name: "Joao Guilherme" }],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/img/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/img/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/img/icons/apple-touch-icon.png",
  },
  manifest: "/img/icons/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "YouTube Analyzer",
    title: "YouTube Analyzer - Channel Statistics & Video Performance",
    description:
      "Free tool to analyze YouTube channel statistics and video performance metrics.",
    images: [{ url: "/og-image.svg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "YouTube Analyzer",
    description: "Analyze YouTube channel statistics and video performance",
    images: ["/og-image.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: SITE_URL,
  },
  verification: {
    google: "xt6lRdSB-ju79svlnCd-RXOe62DarxQhb127x53IaVA",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased gradient-bg min-h-screen`}>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-17815630894"
          strategy="afterInteractive"
        />
        <Script id="google-ads" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-17815630894');
          `}
        </Script>
        <Providers posthogApiKey={process.env.NEXT_PUBLIC_POSTHOG_KEY}>
          <div className="fixed right-14 sm:right-4 top-2 sm:top-3 z-[60] flex items-center gap-2">
            <UserMenu />
          </div>
          {children}
        </Providers>
      </body>
    </html>
  );
}


