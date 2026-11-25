import type {OrganizerTierBenefit} from "@/lib/api";

// The organizer can promise and fulfill a discount, gift or other in-person
// benefit. This is distinct from TicketTreat automatically granting an extra
// ticket or opening registration early (neither is implemented yet).
const DEFAULT_UNAVAILABLE:Record<string,{en:string;cs:string}>={
  insider:{en:"Early registration (coming soon)",cs:"Dřívější registrace (připravujeme)"},
  vip:{en:"Companion benefit (coming soon)",cs:"Výhoda pro doprovod (připravujeme)"},
};

export function organizerManagedBenefit(benefit:OrganizerTierBenefit):boolean{
  if(benefit.operational)return false;
  const original=DEFAULT_UNAVAILABLE[benefit.tier];
  if(!original)return false;
  return Boolean((benefit.description_en??"").trim()||(benefit.description_cs??"").trim()||
    benefit.label_en.trim()!==original.en||benefit.label_cs.trim()!==original.cs);
}

export function benefitStatus(benefit:OrganizerTierBenefit|undefined,
  language:"cs"|"en"|"ru"|"uk",fallbackLive=false){
  const cs=language==="cs";
  if(!benefit)return {kind:fallbackLive?"live":"soon",text:fallbackLive?(cs?"Aktivní":"Active"):(cs?"Připravujeme":"Coming soon")};
  if(benefit.operational)return benefit.enabled
    ?{kind:"live",text:cs?"Aktivní":"Active"}
    :{kind:"paused",text:cs?"Pozastaveno":"Paused"};
  if(organizerManagedBenefit(benefit))return {kind:"manual",text:cs?"Zajišťuje pořadatel":"Provided by organizer"};
  return {kind:"soon",text:cs?"Připravujeme":"Coming soon"};
}
