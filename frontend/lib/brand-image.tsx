import {ImageResponse} from "next/og";
import {readFileSync} from "node:fs";
import {join} from "node:path";

// The submitted TicketTreat ticket mark, shared across the website's
// app icons, PWA and Telegram brand asset. Keep source in /public.
const image="data:image/png;base64,"+
  readFileSync(join(process.cwd(),"public","app-icon-256.png")).toString("base64");

export function ticketTreatIcon(size:number):ImageResponse {
  return new ImageResponse(
    <div style={{width:size,height:size,display:"flex"}}>
      <img src={image} alt="TicketTreat" width={size} height={size}/>
    </div>,{width:size,height:size}
  );
}
