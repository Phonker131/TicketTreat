import type {Metadata} from "next";
import {Suspense} from "react";
import {EventChatInbox} from "@/components/EventChatClient";
export const metadata:Metadata={title:"Organizer messages | TicketTreat",robots:{index:false,follow:false}};
export default function OrganizerMessagesPage(){return <Suspense fallback={<main className="page"><div className="state-card">Loading messages…</div></main>}><EventChatInbox mode="organizer"/></Suspense>;}
