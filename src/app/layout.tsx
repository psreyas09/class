import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "ClassDesk",
  description: "Utilitarian dashboard for college classroom tasks and communication",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <link
          rel="preconnect"
          href="https://awsdidfgexircpeqtnto.supabase.co"
          crossOrigin=""
        />
        <link
          rel="dns-prefetch"
          href="https://awsdidfgexircpeqtnto.supabase.co"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)] selection:bg-amber-500/20 selection:text-amber-700 dark:selection:text-amber-300">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
