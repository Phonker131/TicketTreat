import type {Metadata} from "next";
import {ProfileClient} from "@/components/ProfileClient";

export const metadata:Metadata={title:"Sign in | TicketTreat",robots:{index:false,follow:true}};

export default function Page(){
  return <ProfileClient screen="login"/>;
}
