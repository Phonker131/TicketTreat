import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {HomeClient} from "@/components/HomeClient";
import {publicEvents} from "@/lib/public-events";
import {homeAlternates} from "@/lib/faq-seo";
type Props={params:Promise<{locale:string}>};
const languageMeta={
  cs:{title:"Akce a vstupenky v Česku",description:"Objevujte akce v Česku, rezervujte místa a ukládejte QR vstupenky v TicketTreat."},
  en:{title:"Events and tickets in Czechia",description:"Discover events across Czechia, book your place and keep your QR tickets with TicketTreat."},
  uk:{title:"Події та квитки в Чехії",description:"Знаходьте події в Чехії, бронюйте місця й отримуйте QR-квитки з TicketTreat."}
} as const;
type Locale=keyof typeof languageMeta;
function supported(v:string):v is Locale{return Object.prototype.hasOwnProperty.call(languageMeta,v);}
export const dynamic="force-dynamic";
export async function generateMetadata({params}:Props):Promise<Metadata>{
  const {locale}=await params;if(!supported(locale))return {robots:{index:false,follow:false}};
  const m=languageMeta[locale];return {title:m.title,description:m.description,
    alternates:{canonical:"/"+locale,languages:homeAlternates},
    openGraph:{type:"website",url:"/"+locale,title:m.title,description:m.description},
    robots:{index:true,follow:true}};
}
export default async function LocalizedHome({params}:Props){
  const {locale}=await params;if(!supported(locale))notFound();
  return <HomeClient forcedLanguage={locale} initialEvents={await publicEvents()}/>;
}
