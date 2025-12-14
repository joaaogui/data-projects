import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { Providers } from "@data-projects/ui"
import { AudioPlayerProvider } from "@/components/audio-player-provider"

export const metadata: Metadata = {
  title: "Spotify Popularity",
  description: "Discover the most popular tracks from any artist on Spotify",
  icons: {
    icon: "/favicon.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        <Providers posthogApiKey={process.env.NEXT_PUBLIC_POSTHOG_KEY}>
          <AudioPlayerProvider>
            <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
              <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-spotify/5 via-transparent to-transparent pointer-events-none" />
              <div className="relative">
                {children}
              </div>
            </div>
          </AudioPlayerProvider>
        </Providers>
      </body>
    </html>
  )
}
