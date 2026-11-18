import type {Metadata} from "next";
import {AdminCategoriesClient} from "@/components/AdminCategoriesClient";

export const metadata:Metadata={title:"Event categories | TicketTreat",robots:{index:false,follow:false}};
export default function AdminCategoriesPage(){return <AdminCategoriesClient/>;}
