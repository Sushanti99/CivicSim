import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "CivicSim — Demographically Grounded LLM Opinion Simulation",
  description:
    "Pick a U.S. location, ask a policy question, and watch a synthetic electorate respond.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen">
        <div className="bg-grid" />
        <div className="bg-glow" />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
