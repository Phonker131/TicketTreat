import type {Metadata} from "next";
import {HomeClient} from "@/components/HomeClient";
import {publicEvents} from "@/lib/public-events";
import {homeAlternates} from "@/lib/faq-seo";
export const dynamic="force-dynamic";

export const metadata:Metadata = {
  title:"Мероприятия и билеты в Чехии",
  description:"TicketTreat — мероприятия в Чехии: находите события, бронируйте места и получайте электронные билеты с QR-кодом.",
  alternates:{canonical:"/",languages:homeAlternates},
  openGraph:{url:"/",type:"website",title:"TicketTreat — мероприятия и билеты в Чехии",description:"Откройте мероприятия в Чехии, зарегистрируйтесь и сохраняйте билеты в TicketTreat."},
};

export default async function HomePage() {
  const events=await publicEvents();
  return <HomeClient initialEvents={events}/>;
}
