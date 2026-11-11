import type {Metadata} from "next";
import {OrganizerRewardsClient} from "@/components/OrganizerRewardsClient";

export const metadata:Metadata={title:"Attendance rewards | TicketTreat",robots:{index:false,follow:false}};
export default function OrganizerRewardsPage(){return <OrganizerRewardsClient/>;}
