import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";

import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Clash Deck Advisor",
  description:
    "A private Royal Workshop for evidence-based Clash Royale deck advice.",
  icons: {
    icon: "/crown-mark.svg",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f6f7f3",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${manrope.variable}`}>
      <body>
        <a
          href="#main-content"
          className="royal-focus fixed left-3 top-3 z-[100] inline-flex min-h-11 -translate-y-16 items-center rounded-lg bg-[#164fc9] px-4 text-sm font-extrabold text-white transition-transform focus:translate-y-0 motion-reduce:transition-none"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
