import type {Metadata} from "next";
import {OrganizerDirectoryClient} from "@/components/OrganizerDirectoryClient";
import {publicOrganizers} from "@/lib/public-organizers";

export const dynamic="force-dynamic";
export const metadata:Metadata={
  title:"Организаторы мероприятий в Чехии",
  description:"Познакомьтесь с организаторами событий на TicketTreat, изучите их профили и предстоящие мероприятия.",
  alternates:{canonical:"/organizers"}
};

export default async function OrganizersPage(){
  return <OrganizerDirectoryClient profiles={await publicOrganizers()}/>;
}
