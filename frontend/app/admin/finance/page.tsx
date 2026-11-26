import type {Metadata} from "next";
import {OrganizerFinanceClient} from "@/components/OrganizerFinanceClient";

export const metadata:Metadata={
  title:"Finances and contracts | TicketTreat",
  robots:{index:false,follow:false},
};

export default function OrganizerFinancePage(){
  return <OrganizerFinanceClient/>;
}
