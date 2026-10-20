"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/components/LanguageProvider";
import { isTelegramWebApp } from "@/lib/telegram";
import { t } from "@/lib/i18n";

export function AppHeader() {
  const { language } = useLanguage();
  const [insideTelegram, setInsideTelegram] = useState(false);

  useEffect(() => setInsideTelegram(isTelegramWebApp()), []);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="wordmark" aria-label="Crowdly">
          crowdly<span className="wordmark-dot" />
        </Link>

        <nav className="topbar-nav">
          <Link href="/">{t(language, "home")}</Link>
          <Link href="/tickets">{t(language, "tickets")}</Link>
          <Link href="/profile">{t(language, "profile")}</Link>
          <Link href="/admin">{t(language, "admin")}</Link>
        </nav>

        <div className="topbar-actions">
          <span className="demo-pill">{t(language, "demo")}</span>
          <span className="mode-pill">
            {insideTelegram ? t(language, "telegramMode") : t(language, "webMode")}
          </span>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
