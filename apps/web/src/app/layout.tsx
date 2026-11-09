import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import type { ReactNode } from "react";
import { clientEnv } from "@/shared/config/env";
import { cn } from "@/shared/ui/cn";
import { BROWSER_THEME_COLOR } from "@/shared/ui/theme";
import "@/app/globals.css";

/** The interface */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

/** Figures, tickers and provenance */
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

/** Brief prose */
const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-newsreader",
});

export const metadata: Metadata = {
  // From the env contract, so preview and production deployments produce correct
  // absolute URLs without a code change.
  metadataBase: new URL(clientEnv.NEXT_PUBLIC_APP_URL),
  title: {
    default: "StockNews",
    template: "%s · StockNews",
  },
  description: "A daily digest of the news that moved the stocks you actually own.",
};

export const viewport: Viewport = {
  themeColor: BROWSER_THEME_COLOR,
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cn(inter.variable, jetBrainsMono.variable, newsreader.variable)}>
      <body>{children}</body>
    </html>
  );
}
