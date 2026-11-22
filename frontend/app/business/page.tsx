import type {Metadata} from "next";
import {BusinessLandingClient} from "@/components/BusinessLandingClient";
export const metadata:Metadata={title:"TicketTreat for organizers",description:"Manage registrations, QR tickets and event check-in with TicketTreat. Free for guests and organizers; guests pay organizers directly.",alternates:{canonical:"/business"}};
export default function BusinessPage(){return <BusinessLandingClient/>;}
