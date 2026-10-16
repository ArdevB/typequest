import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource/orbitron/700.css";
import "@fontsource/orbitron/900.css";
import "./globals.css";

import type { Metadata, Viewport } from "next";
import { SiteHeader } from "@/components/app/SiteHeader";
import { StoreHydrator } from "@/components/app/StoreHydrator";
import { PREPAINT_SCRIPT } from "@/lib/prepaint";
import { DEFAULT_THEME, themeCss } from "@/themes/registry";

export const metadata: Metadata = {
  title: { default: "TypeQuest — learn to type, then get fast", template: "%s · TypeQuest" },
  description:
    "A gamified typing trainer: learn hand placement from scratch, then push your speed with tests, game modes and daily challenges.",
  applicationName: "TypeQuest",
  keywords: ["typing test", "typing practice", "learn to type", "wpm test", "touch typing", "typing game"],
  openGraph: {
    title: "TypeQuest",
    description: "Learn touch typing and race your best WPM.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0614",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme={DEFAULT_THEME} data-cb="false" data-rm="false" suppressHydrationWarning>
      <head>
        <style id="tq-themes">{themeCss()}</style>
        <script dangerouslySetInnerHTML={{ __html: PREPAINT_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50">
          Skip to content
        </a>
        <StoreHydrator />
        <SiteHeader />
        <main id="main" className="flex w-full flex-1 flex-col px-4 pb-10 sm:px-6">
          {children}
        </main>
      </body>
    </html>
  );
}
