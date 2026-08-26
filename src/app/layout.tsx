import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/nav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Finanzübersicht",
  description: "Cashflow, Portfolio und Net Worth an einem Ort.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-10 border-b border-border-base bg-surface/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3">
            <span className="text-sm font-semibold tracking-tight">Finanzübersicht</span>
            <Nav />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">{children}</main>

        <footer className="border-t border-border-base px-5 py-4 text-center text-xs text-text-muted">
          Kurse via Yahoo Finance (End-of-Day) · Basiswährung EUR
        </footer>
      </body>
    </html>
  );
}
