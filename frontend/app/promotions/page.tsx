import type {Metadata} from "next";
import {PromotionsClient} from "@/components/PromotionsClient";
export const metadata:Metadata={title:"Promotions | TicketTreat",description:"Discover time-limited organizer promotions on TicketTreat.",alternates:{canonical:"/promotions"}};
export default function PromotionsPage(){return <PromotionsClient/>;}
