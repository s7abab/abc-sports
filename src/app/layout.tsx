import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { PwaOfflineSync } from "@/components/pwa-offline-sync";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import "./globals.css";

const geistSans = localFont({
  src: "../../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2",
  variable: "--font-space-grotesk",
  display: "swap",
});

const geistMono = localFont({
  src: "../../node_modules/next/dist/next-devtools/server/font/geist-mono-latin.woff2",
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "ABC Sports",
  title: "ABC Sports | Live Streaming Home",
  description: "A modern sports streaming home for featured fixtures and live match browsing.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ABC Sports",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#06070b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-full flex flex-col bg-[#06070b] text-slate-100">
        {children}
        <ServiceWorkerRegistration />
        <PwaInstallPrompt />
        <PwaOfflineSync />
        <Analytics />
      </body>
    </html>
  );
}
