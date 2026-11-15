import type {Metadata} from "next";
import {PromotionsAdminClient} from "@/components/PromotionsAdminClient";
export const metadata:Metadata={title:"Marketing campaigns | TicketTreat",robots:{index:false,follow:false}};
export default function PromotionsAdminPage(){return <PromotionsAdminClient/>;}
