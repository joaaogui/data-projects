import type { Metadata, Viewport } from "next";
import { Bungee, Nunito_Sans } from "next/font/google";

import "./globals.css";

const bungee = Bungee({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const nunito = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Brawl Account Coach",
  description:
    "A private progression dossier for Brawl Stars player #Y0GLCU0GL.",
  icons: {
    icon: "/brawl-mark.svg",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#155eef",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bungee.variable} ${nunito.variable}`}>
      <body>
        <a
          href="#main-content"
          className="arcade-focus fixed left-3 top-3 z-[100] -translate-y-16 border-2 border-[#101631] bg-[#155eef] px-3 py-2 text-sm font-black text-white shadow-[3px_3px_0_#101631] transition-transform focus:translate-y-0"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
