"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  normalizeLanguage,
} from "@/lib/i18n";
import { getTelegramWebApp } from "@/lib/telegram";
import type { LanguageCode } from "@/lib/types";

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
};

const LanguageContext =
  createContext<LanguageContextValue | null>(null);

function getInitialLanguage(): LanguageCode {
  if (typeof window === "undefined") {
    return "ru";
  }

  const queryLanguage = normalizeLanguage(
    new URLSearchParams(
      window.location.search,
    ).get("lang"),
  );

  if (queryLanguage) {
    return queryLanguage;
  }

  const stored = normalizeLanguage(
    window.localStorage.getItem(
      "crowdly_interface_language",
    ),
  );

  if (stored) {
    return stored;
  }

  const telegramLanguage = normalizeLanguage(
    getTelegramWebApp()
      ?.initDataUnsafe
      ?.user
      ?.language_code,
  );

  if (telegramLanguage) {
    return telegramLanguage;
  }

  return (
    normalizeLanguage(window.navigator.language) ||
    "ru"
  );
}

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [language, setLanguageState] =
    useState<LanguageCode>("ru");

  useEffect(() => {
    setLanguageState(getInitialLanguage());
  }, []);

  const setLanguage = (
    nextLanguage: LanguageCode,
  ) => {
    setLanguageState(nextLanguage);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "crowdly_interface_language",
        nextLanguage,
      );
    }
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
    }),
    [language],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error(
      "useLanguage must be used inside LanguageProvider",
    );
  }

  return context;
}
