import type {Metadata} from "next";
import {AdminSupportClient} from "@/components/AdminSupportClient";
export const metadata:Metadata={title:"Support inbox — TicketTreat"};
export default function AdminSupportPage(){return <AdminSupportClient/>;}
