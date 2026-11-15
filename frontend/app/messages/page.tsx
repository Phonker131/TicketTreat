import type {Metadata} from "next";
import {EventChatInbox} from "@/components/EventChatClient";
export const metadata:Metadata={title:"Messages | TicketTreat",robots:{index:false,follow:false}};
export default function MessagesPage(){return <EventChatInbox mode="participant"/>;}
