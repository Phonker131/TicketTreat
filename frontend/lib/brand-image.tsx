import {ImageResponse} from "next/og";

// Reuses the established TicketTreat magenta / sunflower / midnight palette.
export function ticketTreatIcon(size: number): ImageResponse {
  return new ImageResponse(
    <div style={{display:"flex",width:"100%",height:"100%",alignItems:"center",justifyContent:"center",background:"#C2118A",borderRadius:Math.round(size*.23),position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:size*.12,right:size*.12,width:size*.18,height:size*.18,borderRadius:999,background:"#FFC82E"}}/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",borderWidth:Math.max(3,Math.round(size*.043)),borderStyle:"solid",borderColor:"#fff",borderRadius:Math.round(size*.085),width:size*.69,height:size*.42}}>
        <span style={{fontSize:size*.26,fontFamily:"sans-serif",fontWeight:900,letterSpacing:-size*.022,color:"#fff"}}>TT</span>
      </div>
    </div>,
    {width:size,height:size}
  );
}
