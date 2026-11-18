import type {Metadata} from "next";
import {OrganizerSubscriptionRewardsClient} from "@/components/OrganizerSubscriptionRewardsClient";

export const metadata:Metadata={title:"Organizer Rewards | TicketTreat",robots:{index:false,follow:false}};
export default function OrganizerRewardsPage(){return <OrganizerSubscriptionRewardsClient/>;}
