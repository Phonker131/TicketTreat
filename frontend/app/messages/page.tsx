import type {Metadata} from "next";
import {Suspense} from "react";
import {EventChatInbox} from "@/components/EventChatClient";
export const metadata:Metadata={title:"Messages | TicketTreat",robots:{index:false,follow:false}};
export default function MessagesPage(){return <Suspense fallback={<main className="page"><div className="state-card">Loading messages…</div></main>}><EventChatInbox mode="participant"/></Suspense>;}
