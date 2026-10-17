import { Providers } from "@data-projects/ui";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://housing.joaog.space";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Housing",
    template: "%s | Housing",
  },
  description:
    "Radar analítico de locação residencial em BH, Campinas, RJ e SP: 20 bairros ponderados, calibrador de pesos em tempo real e auditoria matemática de imóveis.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Housing",
    title: "Housing",
    description:
      "Explore rankings dinâmicos de 20 bairros e mais de 2.400 imóveis em BH, Campinas, RJ e SP com pesos ajustáveis e justificativas matemáticas.",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Card thumbnails come straight from the portals' CDNs (already 1-year cacheable). */}
        <link rel="preconnect" href="https://www.quintoandar.com.br" />
        <link rel="preconnect" href="https://resizedimgs.zapimoveis.com.br" />
        <link rel="dns-prefetch" href="https://resizedimgs.vivareal.com" />
        <link rel="dns-prefetch" href="https://imgbr.imovelwebcdn.com" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased min-h-dvh`}
      >
        <Providers posthogApiKey={process.env.NEXT_PUBLIC_POSTHOG_KEY}>
          <main
            id="main-content"
            className="mx-auto w-full max-w-[1640px] px-3 py-4 sm:px-6 sm:py-5"
          >
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
