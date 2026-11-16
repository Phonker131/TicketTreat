import type {Metadata} from "next";
import {NotFoundClient} from "@/components/NotFoundClient";

export const metadata: Metadata = {title: "Page not found", robots: {index: false}};

export default function NotFound(){
  return <NotFoundClient/>;
}
