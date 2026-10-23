import {Suspense} from "react";
import type {Metadata} from "next";
import {SupportClient} from "@/components/SupportClient";
export const metadata:Metadata={title:"Support — TicketTreat",description:"Contact TicketTreat support and manage your requests."};
export default function SupportPage(){return <Suspense fallback={<main>Loading…</main>}><SupportClient/></Suspense>}
