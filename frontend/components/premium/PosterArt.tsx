import type {CSSProperties} from "react";

/** Generative riso-style poster used when an event has no photo yet. Deterministic per seed, themed by brand inks only. */
const inks=[
 {bg:"#0297DE",fg:"#02070A",dot:"rgba(2,7,10,.2)",edge:"#F0EBE1"},
 {bg:"#FC734D",fg:"#02070A",dot:"rgba(2,7,10,.18)",edge:"#F0EBE1"},
 {bg:"#04202E",fg:"#0297DE",dot:"rgba(2,151,222,.2)",edge:"#FC734D"},
 {bg:"#02070A",fg:"#FC734D",dot:"rgba(252,115,77,.16)",edge:"#0297DE"}
] as const;

function star(points:number,outer:number,inner:number){
 let d="";
 for(let i=0;i<points*2;i++){
  const r=i%2?inner:outer,a=(Math.PI*i)/points-Math.PI/2;
  d+=(i?"L":"M")+(50+r*Math.cos(a)).toFixed(2)+" "+(50+r*Math.sin(a)).toFixed(2);
 }
 return d+"Z";
}
const glyphs=[
 <path key="burst" d={star(12,46,31)}/>,
 <g key="plus"><rect x="38" y="6" width="24" height="88" rx="9"/><rect x="6" y="38" width="88" height="24" rx="9"/></g>,
 <g key="ast"><rect x="39" y="4" width="22" height="92" rx="9"/><rect x="39" y="4" width="22" height="92" rx="9" transform="rotate(60 50 50)"/><rect x="39" y="4" width="22" height="92" rx="9" transform="rotate(120 50 50)"/></g>,
 <path key="wave" d="M4 56c10-30 20-30 30 0s20 30 30 0 20-30 32 0" fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round"/>
];

export function PosterArt({seed=0,className="",label}:{seed?:number|string;className?:string;label?:string}){
 const n=typeof seed==="number"?seed:Array.from(String(seed)).reduce((a,c)=>a*31+c.charCodeAt(0),7);
 const i=Math.abs(n)%inks.length,g=Math.abs(n>>2)%glyphs.length,ink=inks[i];
 const id="pa"+i+g+Math.abs(n)%97;
 const style={color:ink.fg,background:ink.bg,"--pa-edge":ink.edge} as CSSProperties;
 return <div className={"tp-poster-art "+className} style={style} role={label?"img":undefined} aria-label={label} aria-hidden={label?undefined:true}>
  <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" focusable="false">
   <defs><pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><circle cx="7" cy="7" r="2.8" fill={ink.dot}/></pattern></defs>
   <rect width="400" height="300" fill={`url(#${id})`}/>
   <g transform="translate(112 34) scale(1.8)" fill="currentColor" opacity=".92">{glyphs[g]}</g>
   <g transform="translate(116 38) scale(1.8)" fill="none" stroke={ink.edge} strokeWidth=".8" opacity=".55">{glyphs[g]}</g>
  </svg>
  <span className="tp-poster-art-tag">TICKETTREAT</span>
 </div>;
}
