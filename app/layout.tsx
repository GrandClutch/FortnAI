import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      className={`${aeonik.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
