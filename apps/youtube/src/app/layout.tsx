import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers, ThemeToggle } from "@data-projects/ui";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
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
    "channel statistics",
    "video performance",
    "youtube metrics",
    "video analysis",
    "youtube channel analyzer",
    "video stats",
  ],
  authors: [{ name: "Joao Guilherme" }],
  icons: {
    icon: "/favicon.svg",
  },
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${roboto.variable} font-sans antialiased gradient-bg min-h-screen`}>
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
          <div className="fixed right-4 top-4 z-50">
            <ThemeToggle iconClassName="text-primary" />
          </div>
          {children}
        </Providers>
      </body>
    </html>
  );
}


