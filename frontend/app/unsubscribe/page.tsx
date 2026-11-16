import type {Metadata} from "next";
import {EmailUnsubscribe} from "@/components/EmailUnsubscribe";
export const metadata:Metadata={title:"Unsubscribe | TicketTreat",robots:{index:false,follow:false},referrer:"no-referrer"};
export default function UnsubscribePage(){return <EmailUnsubscribe/>;}
