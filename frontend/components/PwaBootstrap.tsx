"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getTelegramWebApp } from "@/lib/telegram";
import { getVerifiedTelegramSession } from "@/lib/session";

const STARTAPP_ROUTES: Record<string, string> = {
  tickets: "/tickets",
  loyalty: "/loyalty",
  support: "/support",
  profile: "/profile",
};

/** Untrusted launch parameters can select public routes, never account identity. */
function getStartappTarget(value: string | null): string | null {
  if (!value) return null;
  const event = /^event_([1-9][0-9]{0,8})$/.exec(value);
  if (event) return `/events/${event[1]}?utm_source=telegram`;
  return Object.prototype.hasOwnProperty.call(STARTAPP_ROUTES, value)
    ? STARTAPP_ROUTES[value]
    : null;
}

export function PwaBootstrap() {
  const router = useRouter();
  useEffect(() => {
    if (
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((error) => {
          console.error(
            "Service worker registration failed",
            error,
          );
        });
    }

    const webApp = getTelegramWebApp();

    // Direct/Main Mini App links carry an optional startapp payload.
    // Use signed initData when available; the Telegram query parameter is a
    // routing hint only and does not grant privileges or authenticate users.
    if (webApp?.initData && window.location.pathname === "/") {
      const launchParams = new URLSearchParams(webApp.initData);
      const target = getStartappTarget(
        launchParams.get("start_param") ||
          new URLSearchParams(window.location.search).get("tgWebAppStartParam")
      );
      if (target) router.replace(target);
    }

    if (webApp) {
      webApp.ready();
      webApp.expand();
      webApp.setHeaderColor?.("#F6EEFA");
      webApp.setBackgroundColor?.("#F6EEFA");
      if (webApp.initData) {
        void getVerifiedTelegramSession().catch(() => {
          // Do not expose Telegram initData or server details in browser logs.
          console.warn("TicketTreat: Telegram Mini App authentication unavailable.");
        });
      }
    }
  }, [router]);

  return null;
}
