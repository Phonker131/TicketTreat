import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

import { LanguageProvider } from "@/components/LanguageProvider";
import { PwaBootstrap } from "@/components/PwaBootstrap";

export const metadata: Metadata = {
  title: {
    default: "TicketTreat",
    template: "%s · TicketTreat",
  },
  description: "Events, tickets and reminders in one place.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TicketTreat",
  },
  icons: {
    icon: "/icon",
    apple: "/apple-icon",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#C2118A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <LanguageProvider>
          <PwaBootstrap />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
