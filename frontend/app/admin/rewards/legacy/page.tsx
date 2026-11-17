import type {Metadata} from "next";
import {OrganizerRewardsClient} from "@/components/OrganizerRewardsClient";

/** Historical event badges are retained for existing grants and reversals.
 * The organizer-wide tier program lives at /admin/rewards. */
export const metadata:Metadata={title:"Historical attendance badges | TicketTreat",robots:{index:false,follow:false}};
export default function LegacyRewardsPage(){return <OrganizerRewardsClient/>;}
