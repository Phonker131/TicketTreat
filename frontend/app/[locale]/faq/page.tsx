import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {FaqClient} from "@/components/FaqClient";
import {faqAlternates} from "@/lib/faq-seo";
import {faqCopy} from "@/lib/faq-content";
import {jsonLd} from "@/lib/site-schema";
type Params={params:Promise<{locale:string}>};
const meta={
 cs:{title:"Často kladené otázky",description:"Odpovědi na otázky o akcích, vstupenkách s QR kódem, Telegramu a podpoře TicketTreat."},
 en:{title:"Frequently Asked Questions",description:"Answers about TicketTreat event registration, QR tickets, Telegram and organizer-direct payments."},
 uk:{title:"Поширені запитання",description:"Відповіді про події, QR-квитки, Telegram, оплату організатору й підтримку TicketTreat."}
} as const;
type Locale=keyof typeof meta;
function supported(x:string):x is Locale{return Object.prototype.hasOwnProperty.call(meta,x);}
export const dynamicParams=false;
export function generateStaticParams(){return [{locale:"cs"},{locale:"en"},{locale:"uk"}];}
export async function generateMetadata({params}:Params):Promise<Metadata>{
  const {locale}=await params;
  if(!supported(locale))return {robots:{index:false,follow:false}};
  const m=meta[locale];
  return {
    title:m.title,description:m.description,
    alternates:{canonical:"/"+locale+"/faq",languages:faqAlternates},
    openGraph:{type:"website",title:m.title,description:m.description,url:"/"+locale+"/faq"},
    robots:{index:true,follow:true},
  };
}
export default async function LocalizedFaq({params}:Params){
  const {locale}=await params;
  if(!supported(locale))notFound();
  const faq={"@context":"https://schema.org","@type":"FAQPage","inLanguage":locale,
    "mainEntity":faqCopy[locale].sections.flatMap(s=>s.items).map(item=>({"@type":"Question","name":item.q,
      "acceptedAnswer":{"@type":"Answer","text":item.a}}))};
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(faq)}}/>
    <FaqClient forcedLanguage={locale}/>
  </>;
}
