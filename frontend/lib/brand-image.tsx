import {ImageResponse} from "next/og";

// TicketTreat 1.0 official ticket mark; matches public/tickettreat-mark.svg.
export function ticketTreatIcon(size: number): ImageResponse {
  const scale = size / 192;
  return new ImageResponse(
    <div style={{display:"flex",width:"100%",height:"100%",alignItems:"center",justifyContent:"center",background:"#FF5533",borderRadius:Math.round(size*34/192),position:"relative"}}>
      <svg width={size} height={size} viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
        <path d="M46 61h100a12 12 0 0 1 12 12v10a13 13 0 0 0 0 26v10a12 12 0 0 1-12 12H46a12 12 0 0 1-12-12v-10a13 13 0 0 0 0-26V73a12 12 0 0 1 12-12Z" fill="#F0EBE1" stroke="#15141F" strokeWidth="6"/>
        <path d="M54 81h38m-19 0v37m20-37h38m-19 0v37" stroke="#15141F" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="150" cy="41" r="18" fill="#F4B400" stroke="#15141F" strokeWidth="5"/>
      </svg>
    </div>,
    {width:size,height:size}
  );
}
