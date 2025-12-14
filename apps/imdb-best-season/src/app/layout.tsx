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
    "Discover which season of your favorite TV show is the best rated according to IMDb episode ratings",
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
        <Providers defaultTheme="dark" posthogApiKey={process.env.NEXT_PUBLIC_POSTHOG_KEY}>{children}</Providers>
      </body>
    </html>
  );
}


