import type {Metadata} from "next";
import {FaqClient} from "@/components/FaqClient";

export const metadata:Metadata={
  title:"FAQ — Frequently Asked Questions",
  description:"Answers about TicketTreat event registration, QR tickets, Telegram, organizer-direct payments and support in Czechia.",
};
export default function FaqPage(){return <FaqClient/>;}
