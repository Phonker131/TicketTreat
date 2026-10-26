export const FAQ_LOCALES=["ru","cs","en","uk"] as const;
export type FaqLocale=typeof FAQ_LOCALES[number];
export function faqUrl(locale:FaqLocale):string{return locale==="ru"?"/faq":"/"+locale+"/faq";}
export const faqAlternates={ru:"/faq",cs:"/cs/faq",en:"/en/faq",uk:"/uk/faq","x-default":"/faq"};
