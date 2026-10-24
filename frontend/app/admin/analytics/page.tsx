import type {Metadata} from "next";
import {OrganizerAnalyticsClient} from "@/components/OrganizerAnalyticsClient";
export const metadata:Metadata={title:"Organizer analytics | TicketTreat",robots:{index:false,follow:false}};
export default function OrganizerAnalyticsPage(){return <OrganizerAnalyticsClient/>;}
