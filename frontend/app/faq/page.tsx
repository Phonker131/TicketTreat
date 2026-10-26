import type {Metadata} from "next";
import {FaqClient} from "@/components/FaqClient";
import {faqAlternates} from "@/lib/faq-seo";

export const metadata:Metadata={
  title:"FAQ — Frequently Asked Questions",
  description:"Ответы о билетах, регистрации, Telegram, оплате организатору и поддержке TicketTreat.",
  alternates:{canonical:"/faq",languages:faqAlternates},
  openGraph:{type:"website",url:"/faq",title:"Частые вопросы — TicketTreat"},
};
export default function FaqPage(){return <FaqClient/>;}
