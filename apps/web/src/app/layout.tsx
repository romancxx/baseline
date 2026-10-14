import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { clientEnv } from "@/shared/config/env";
import { BROWSER_THEME_COLOR } from "@/shared/ui/theme";
import "@/app/globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  // From the env contract, so preview and production deployments produce correct
  // absolute URLs without a code change.
  metadataBase: new URL(clientEnv.NEXT_PUBLIC_APP_URL),
  title: {
    default: "Stock News",
    template: "%s · Stock News",
  },
  description: "A daily digest of the news that moved the stocks you actually own.",
};

export const viewport: Viewport = {
  themeColor: BROWSER_THEME_COLOR,
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
