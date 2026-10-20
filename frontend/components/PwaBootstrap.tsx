"use client";

import { useEffect } from "react";

import { getTelegramWebApp } from "@/lib/telegram";

export function PwaBootstrap() {
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

    if (webApp) {
      webApp.ready();
      webApp.expand();
      webApp.setHeaderColor?.("#F6EEFA");
      webApp.setBackgroundColor?.("#F6EEFA");
    }
  }, []);

  return null;
}
