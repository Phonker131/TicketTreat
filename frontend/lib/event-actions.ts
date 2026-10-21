import type {TicketTreatEvent} from "@/lib/types";

function icsEscape(value:string):string {
  return value.replace(/\\/g,"\\\\").replace(/\r?\n/g,"\\n")
    .replace(/,/g,"\\,").replace(/;/g,"\\;");
}

export function calendarICS(event:TicketTreatEvent, publicUrl:string):string {
  // Event times in the current API represent venue-local wall-clock time.
  // Floating DTSTART avoids silently shifting a Prague event to the visitor's zone.
  const match=(event.starts_at||"").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if(!match)throw new Error("Date unavailable");
  const start=match.slice(1,6).join("")+(match[6]||"00");
  const now=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
  return [
    "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//TicketTreat//Events//EN",
    "BEGIN:VEVENT",
    `UID:event-${event.id}@tickettreat.eu`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `SUMMARY:${icsEscape(event.title)}`,
    `DESCRIPTION:${icsEscape(event.description||"")}`,
    `LOCATION:${icsEscape([event.location,event.city,event.country_code].filter(Boolean).join(", "))}`,
    `URL:${publicUrl}`,
    "END:VEVENT","END:VCALENDAR",""
  ].join("\r\n");
}

export function downloadCalendar(event:TicketTreatEvent, url:string):void {
  const blob=new Blob([calendarICS(event,url)],{type:"text/calendar;charset=utf-8"});
  const link=document.createElement("a");
  const blobUrl=URL.createObjectURL(blob);
  link.href=blobUrl;
  link.download=`tickettreat-event-${event.id}.ics`;
  document.body.append(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(blobUrl),1000);
}

export function mapQuery(event:TicketTreatEvent):string|null {
  const location=[event.location,event.city,event.country_code].filter(Boolean).join(", ");
  return location? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`:null;
}
