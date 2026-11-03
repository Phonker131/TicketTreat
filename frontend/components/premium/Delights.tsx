"use client";
import {useEffect} from "react";

const SPOT=".tp-level,.tp-feed .event-card,.tp-how-list button";

/** Small pointer-only touches: a soft light that follows the cursor over cards. Does nothing on touch screens. */
export function Delights(){
  useEffect(()=>{
    if(!window.matchMedia("(hover: hover) and (pointer: fine)").matches)return;
    let frame=0,last:PointerEvent|null=null;
    const move=(e:PointerEvent)=>{
      last=e;
      if(frame)return;
      frame=requestAnimationFrame(()=>{
        frame=0;
        const el=(last?.target as Element|null)?.closest?.(SPOT) as HTMLElement|null;
        if(!el||!last)return;
        const r=el.getBoundingClientRect();
        el.style.setProperty("--mx",last.clientX-r.left+"px");
        el.style.setProperty("--my",last.clientY-r.top+"px");
      });
    };
    document.addEventListener("pointermove",move,{passive:true});
    return()=>{document.removeEventListener("pointermove",move);cancelAnimationFrame(frame)};
  },[]);
  return null;
}
