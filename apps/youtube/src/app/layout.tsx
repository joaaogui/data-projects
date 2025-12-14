import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import { Providers, ThemeToggle } from "@data-projects/ui";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "YouTube Analyzer",
  description: "Analyze YouTube channel statistics and video performance",
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
      <body className={`${roboto.variable} font-sans antialiased gradient-bg min-h-screen`}>
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


