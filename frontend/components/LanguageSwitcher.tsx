"use client";

import {
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
} from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <label className="language-switcher">
      <span className="sr-only">
        Interface language
      </span>
      <select
        value={language}
        onChange={(event) => {
          setLanguage(
            event.target.value as typeof language,
          );
        }}
      >
        {SUPPORTED_LANGUAGES.map((code) => (
          <option key={code} value={code}>
            {LANGUAGE_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
