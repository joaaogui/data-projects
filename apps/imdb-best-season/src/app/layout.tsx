import type { Metadata } from "next";
import { Libre_Baskerville, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@data-projects/ui";

const libreBaskerville = Libre_Baskerville({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IMDb Best Season | TV Show Season Ranker",
  description:
    "Discover which season of your favorite TV show ranks highest by the median of IMDb and TMDB episode ratings",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${libreBaskerville.variable} ${jetbrainsMono.variable} font-sans gradient-bg min-h-screen`}
      >
        <Providers defaultTheme="dark" posthogApiKey={process.env.NEXT_PUBLIC_POSTHOG_KEY}>
          <a
            href="#main-content"
            className="fixed left-3 top-3 z-[100] -translate-y-16 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-transform focus:translate-y-0"
          >
            Skip to content
          </a>
          {children}
        </Providers>
      </body>
    </html>
  );
}


