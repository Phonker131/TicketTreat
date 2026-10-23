import {ImageResponse} from "next/og";

/**
 * TicketTreat brand-book style stacked wordmark for the PWA home-screen icon.
 * The previous standalone "TT" badge is deliberately not used.
 * Browser SVG favicon: public/favicon.svg.
 */
export function ticketTreatIcon(size: number): ImageResponse {
  return new ImageResponse(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",width:"100%",height:"100%",background:"#F0EBE1"}}>
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 128 128" role="img">
        <rect x="1.5" y="1.5" width="125" height="125" rx="15" fill="#F0EBE1" stroke="#15141F" strokeWidth="3"/>
        <g>
          <text x="7" y="56" fill="#FF5533" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="32" textLength="112" lengthAdjust="spacingAndGlyphs">TICKET</text>
          <text x="5" y="54" fill="#15141F" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="32" textLength="112" lengthAdjust="spacingAndGlyphs">TICKET</text>
          <path d="M13 65H115V79C108 79 105 86 105 90C105 94 108 101 115 101V115H13V101C20 101 23 94 23 90C23 86 20 79 13 79Z" fill="#F4B400" stroke="#15141F" strokeWidth="3" strokeLinejoin="round"/>
          <text x="30" y="101" fill="#15141F" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="27" textLength="73" lengthAdjust="spacingAndGlyphs">TREAT</text>
        </g>
      </svg>
    </div>,{width:size,height:size},
  );
}
