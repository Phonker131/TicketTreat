import type {Metadata} from "next";
import {EventChatInbox} from "@/components/EventChatClient";
export const metadata:Metadata={title:"Organizer messages | TicketTreat",robots:{index:false,follow:false}};
export default function OrganizerMessagesPage(){return <EventChatInbox mode="organizer"/>;}
