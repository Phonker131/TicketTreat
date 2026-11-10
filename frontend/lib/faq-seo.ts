/** Public SEO locales offered by TicketTreat. Legacy RU/UK are retired. */
export const FAQ_LOCALES=["cs","en"] as const;
export type FaqLocale=typeof FAQ_LOCALES[number];
export function faqUrl(locale:FaqLocale):string{return "/"+locale+"/faq";}
export const faqAlternates={cs:"/cs/faq",en:"/en/faq","x-default":"/en/faq"};

export const HOME_LOCALES=["cs","en"] as const;
export type HomeLocale=typeof HOME_LOCALES[number];
export function homeUrl(locale:HomeLocale):string{return "/"+locale;}
export const homeAlternates={cs:"/cs",en:"/en","x-default":"/"};
