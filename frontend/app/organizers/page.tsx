import type {Metadata} from "next";
import {OrganizerDirectoryClient} from "@/components/OrganizerDirectoryClient";
import {publicOrganizers} from "@/lib/public-organizers";

export const dynamic="force-dynamic";
export const metadata:Metadata={
  title:"Event organizers in Czechia",
  description:"Meet the people behind game nights, quizzes and workshops in Prague and across Czechia, and see their upcoming events on TicketTreat.",
  alternates:{canonical:"/organizers"}
};

export default async function OrganizersPage(){
  return <OrganizerDirectoryClient profiles={await publicOrganizers()}/>;
}
