"use client";

import { useEffect, useRef, useState } from "react";
import {usePathname,useRouter} from "next/navigation";
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import type { LanguageCode } from "@/lib/types";

const FLAGS: Record<LanguageCode, string> = {
  ru: "🇷🇺",
  uk: "🇺🇦",
  cs: "🇨🇿",
  en: "🇬🇧",
};

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const pathname=usePathname();
  const router=useRouter();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    function closeEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  const action={ru:"Сменить язык",cs:"Změnit jazyk",uk:"Змінити мову",en:"Change language"}[language];
  const selectLabel={ru:"Выбери язык интерфейса",cs:"Vyberte jazyk rozhraní",uk:"Оберіть мову інтерфейсу",en:"Select interface language"}[language];
  return (
    <div className="language-switcher" ref={root}>
      <button
        type="button"
        className="language-flag-trigger"
        aria-label={`${action}: ${LANGUAGE_LABELS[language]}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
      >
        <span className="language-flag" aria-hidden="true">{FLAGS[language]}</span>
        <svg className="language-chevron" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path d="m3 6 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="language-flag-menu" role="menu" aria-label={selectLabel}>
          {SUPPORTED_LANGUAGES.map((code) => (
            <button
              key={code}
              type="button"
              role="menuitemradio"
              aria-checked={language === code}
              aria-label={LANGUAGE_LABELS[code]}
              title={LANGUAGE_LABELS[code]}
              className={`language-flag-option${language === code ? " is-selected" : ""}`}
              onClick={() => {
                setLanguage(code);setOpen(false);
                if(pathname==="/faq"||/^\/(cs|en|uk)\/faq$/.test(pathname)){
                  router.push(code==="ru"?"/faq":"/"+code+"/faq");
                }else if(pathname==="/"||/^\/(cs|en|uk)$/.test(pathname)){
                  router.push(code==="ru"?"/":"/"+code);
                }
              }}
            >
              <span className="language-flag" aria-hidden="true">{FLAGS[code]}</span>
              {language === code && <span className="language-selected-dot" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
