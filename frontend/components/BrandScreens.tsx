"use client";
import {PhoneFrame,LaptopFrame} from "@/components/premium/Device";
import {PhoneScreen,LaptopScreenView,type PhoneScreen as PhoneKind,type LaptopScreen as LaptopKind} from "@/components/premium/Screens";
import type {LanguageCode,TicketTreatEvent} from "@/lib/types";

/* Compatibility wrappers: the old schematic BrandPhone/BrandLaptop now render the premium device frames
   with real, themed, translated screens. Device size comes from the surrounding section (CSS --k). */
const glowFor:Record<PhoneKind,"tom"|"blu"|"yel"|"plum">={discover:"tom",event:"blu",reserve:"yel",ticket:"blu",qr:"tom",passport:"yel"};
export function BrandPhone({kind,language,compact=false}:{kind:PhoneKind;language:LanguageCode;event?:TicketTreatEvent|null;compact?:boolean}){
 return <PhoneFrame glow={glowFor[kind]} className={compact?"is-compact":""}><PhoneScreen kind={kind} language={language}/></PhoneFrame>;
}
export function BrandLaptop({language,kind="guests"}:{language:LanguageCode;kind?:LaptopKind;event?:TicketTreatEvent|null}){
 return <LaptopFrame glow="blu"><LaptopScreenView kind={kind} language={language}/></LaptopFrame>;
}
