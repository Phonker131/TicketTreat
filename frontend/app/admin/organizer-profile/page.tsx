import type {Metadata} from "next";
import {OrganizerProfileEditor} from "@/components/OrganizerProfileEditor";
export const metadata:Metadata={title:"Organizer profile settings",robots:{index:false,follow:false}};
export default function OrganizerProfileSettings(){return <OrganizerProfileEditor/>;}
