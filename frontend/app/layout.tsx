import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

const themeInitScript = `(function(){try{var t=localStorage.getItem("civicsim-theme");document.documentElement.classList.toggle("dark",t==="dark");}catch(e){}})();`;

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
  title: "CivicSim: Demographically Grounded LLM Opinion Simulation",
  description:
    "Pick a U.S. location, ask a policy question, and watch a synthetic electorate respond.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrains.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen">
        <div className="bg-grid" />
        <div className="bg-glow" />
        <div className="relative z-10">{children}</div>
        <ThemeToggle />
      </body>
    </html>
  );
}
