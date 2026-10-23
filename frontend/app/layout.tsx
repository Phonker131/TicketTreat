import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import "./tickettreat-tokens.css";
import "./brand-refresh.css";

import { LanguageProvider } from "@/components/LanguageProvider";
import { PwaBootstrap } from "@/components/PwaBootstrap";

export const metadata: Metadata = {
  title: {
    default: "TicketTreat",
    template: "%s · TicketTreat",
  },
  description: "TicketTreat — discover events, reserve tickets and get helpful reminders in one place.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TicketTreat",
  },
  icons: {
    icon: [{url:"/favicon.svg?v=20261023b",type:"image/svg+xml",sizes:"any"},{url:"/icon",type:"image/svg+xml",sizes:"128x128"}],
    shortcut: "/favicon.svg?v=20261023b",
    apple: "/apple-icon",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#F0EBE1",
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
          <footer className="tt-support-footer">
            <a href="https://t.me/vvladver" target="_blank" rel="noopener noreferrer" aria-label="TicketTreat support on Telegram">
              <span aria-hidden="true">✉</span> Support / Поддержка ↗
            </a>
          </footer>
        </LanguageProvider>
      </body>
    </html>
  );
}
