import type {Metadata} from "next";
import {OrganizerLoyaltyTiersClient} from "@/components/OrganizerLoyaltyTiersClient";

export const metadata:Metadata={title:"Organizer loyalty rewards | TicketTreat",robots:{index:false,follow:false}};
export default function OrganizerRewardsPage(){return <OrganizerLoyaltyTiersClient/>;}
