"use client";
import {useLanguage} from "@/components/LanguageProvider";
export function OrganizerRules(){
 const {language}=useLanguage(); const cs=language==="cs";
 const rules=cs?[
 "Uveďte pravdivý název, popis, datum, místo a kapacitu akce.",
 "Jasně popište cenu, způsob platby, podmínky zrušení a případná věková omezení.",
 "Používejte fotografie, ke kterým máte oprávnění; snímky z minulých akcí tak označte v popisu.",
 "Zkontrolujte kontakty pořadatele a odpovídejte hostům ve zprávách.",
 "Před zveřejněním zkontrolujte náhled. Při změně nebo zrušení informujte registrované hosty."
 ]:[
 "Provide an accurate title, description, date, venue and event capacity.",
 "Explain the price, payment method, cancellation conditions and any age restrictions.",
 "Only use photos you have permission to publish; identify photos from previous events in the description.",
 "Check organizer contact details and respond to guest messages.",
 "Review the preview before publishing. Notify registered guests about changes or cancellation."
 ];
 return <details className="panel"><summary>{cs?"Pravidla a kontrola před zveřejněním":"Publishing rules and checklist"}</summary><ol>{rules.map(r=><li key={r}>{r}</li>)}</ol></details>;
}
