import {useMemo} from "react";
import QRCode from "qrcode";

/** Static decorative QR for examples. Encodes a visibly invalid demo string, never a real ticket code. */
export function Qr({value="TICKETTREAT-EXAMPLE-NOT-A-TICKET",size=200,className=""}:{value?:string;size?:number;className?:string}){
 const {path,count}=useMemo(()=>{
  const qr=QRCode.create(value,{errorCorrectionLevel:"M"});
  const n=qr.modules.size;let d="";
  for(let y=0;y<n;y++){
   let x=0;
   while(x<n){
    if(!qr.modules.get(y,x)){x++;continue}
    const start=x;while(x<n&&qr.modules.get(y,x))x++;
    d+=`M${start} ${y}h${x-start}v1h-${x-start}z`;
   }
  }
  return {path:d,count:n};
 },[value]);
 return <svg className={className} width={size} height={size} viewBox={`0 0 ${count} ${count}`} shapeRendering="crispEdges" fill="currentColor" aria-hidden="true" focusable="false"><path d={path}/></svg>;
}
