import type { Metadata, Viewport } from "next";
import Script from "next/script";
import {Sofia_Sans_Extra_Condensed,Onest,IBM_Plex_Mono} from "next/font/google";
import { LegalFooter } from "@/components/LegalFooter";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import "./globals.css";
import "./tickettreat-tokens.css";
import "./brand-refresh.css";
import "./brand-v11.css";
import "./brand-v11-coverage.css";
import "./revision2.css";
import "./brandbook-fidelity.css";
import "./premium.css";
import "./auth-providers.css";

import { LanguageProvider } from "@/components/LanguageProvider";
import { MotionProvider } from "@/components/MotionProvider";
import { DuoFilters } from "@/components/premium/DuoFilters";
import { Delights } from "@/components/premium/Delights";
import { PwaBootstrap } from "@/components/PwaBootstrap";

// Download at build time, self-host at tickettreat.eu for all visitors.
const poster= Sofia_Sans_Extra_Condensed({
  subsets:["latin","latin-ext","cyrillic","cyrillic-ext"],
  display:"swap",variable:"--font-tt-poster",weight:"variable"
});
const body= Onest({
  subsets:["latin","latin-ext","cyrillic","cyrillic-ext"],
  display:"swap",variable:"--font-tt-onest",weight:"variable"
});
const mono= IBM_Plex_Mono({
  subsets:["latin","latin-ext","cyrillic","cyrillic-ext"],
  display:"swap",variable:"--font-tt-mono",weight:["500","700"],preload:false
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tickettreat.eu"),
  applicationName: "TicketTreat",
  robots: {index: true, follow: true},
  openGraph: {
    siteName: "TicketTreat",
    locale: "en_GB",
    type: "website",
  },
  twitter: {card: "summary"},
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
    icon: [
      {url:"/favicon.svg?v=20261104-logo",type:"image/svg+xml",sizes:"any"},
      {url:"/icon?v=20261104-logo",type:"image/svg+xml",sizes:"any"},
    ],
    shortcut: "/favicon.svg?v=20261104-logo",
    apple: "/apple-icon",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#02070A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${poster.variable} ${body.variable} ${mono.variable}`}>
      <head><script dangerouslySetInnerHTML={{__html:"(function(){try{var t=localStorage.getItem('tt4-theme');if(t!=='dark'&&t!=='light')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','light')}})();"}} /></head>
      <body>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <LanguageProvider>
          <MotionProvider>
            <PwaBootstrap />
            <DuoFilters />
            <Delights />
            {children}
            <LegalFooter />
            <CookieConsentBanner />
          </MotionProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
