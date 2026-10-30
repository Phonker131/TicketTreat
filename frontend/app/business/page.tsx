import type {Metadata} from "next";
import {BusinessLandingClient} from "@/components/BusinessLandingClient";
export const metadata:Metadata={title:"TicketTreat for organizers",description:"Manage event registration, direct-payment confirmations, tickets and check-in with TicketTreat.",alternates:{canonical:"/business"}};
export default function BusinessPage(){return <BusinessLandingClient/>;}
