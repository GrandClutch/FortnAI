import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

import { AppShell } from "@/components/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";

const aeonik = localFont({
  src: "../public/fonts/Aeonik-Regular.woff2",
  variable: "--font-aeonik",
});

export const metadata: Metadata = {
  title: "FortnAI Studio — AI Interior Designer",
  description:
    "Upload a room photo and dimensions to get a full furniture layout, blueprint spec sheet, budget plan, and a photorealistic redesign.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${aeonik.variable} h-full antialiased font-sans`}
    >
      <body className="flex min-h-full flex-col">
        <TooltipProvider>
          <AppShell>{children}</AppShell>
        </TooltipProvider>
      </body>
    </html>
  );
}
