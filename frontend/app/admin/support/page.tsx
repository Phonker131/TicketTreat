import type {Metadata} from "next";
import {AdminSupportClient} from "@/components/AdminSupportClient";
export const metadata:Metadata={title:"Support inbox"};
export default function AdminSupportPage(){return <AdminSupportClient/>;}
