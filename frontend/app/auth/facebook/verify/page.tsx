import type {Metadata} from "next";
import {FacebookEmailVerification} from "@/components/FacebookEmailVerification";

export const metadata:Metadata={
  robots:{index:false,follow:false},
  title:"Verify your email for Facebook login",
};

export default function VerifyFacebookEmailPage(){return <FacebookEmailVerification/>;}
