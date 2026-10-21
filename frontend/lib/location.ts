import type {TicketTreatEvent} from "@/lib/types";

function normalizeCity(raw:string):string {
  return raw.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").trim().toLocaleLowerCase("en").replace(/\s+/g," ");
}
const ALIASES:Record<string,string>={
  "cz:praha":"praha","cz:prague":"praha","cz:прага":"praha","cz:prag":"praha",
  "ua:kyiv":"kyiv","ua:kiev":"kyiv","ua:київ":"kyiv","ua:киев":"kyiv",
  "at:wien":"wien","at:vienna":"wien","de:munchen":"munchen","de:munich":"munchen",
};
export function isInUsersCity(event:TicketTreatEvent, country:string|null,city:string|null):boolean {
  if(!country || !city || !event.country_code || !event.city)return false;
  if(event.country_code.toUpperCase()!==country.toUpperCase())return false;
  const c=country.toLocaleLowerCase("en");
  const a=normalizeCity(city),b=normalizeCity(event.city);
  return (ALIASES[`${c}:${a}`]||a)===(ALIASES[`${c}:${b}`]||b);
}
