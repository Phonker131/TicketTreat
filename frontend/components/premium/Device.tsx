"use client";
import {useRef,type CSSProperties,type PointerEvent,type ReactNode} from "react";
import {useMotionValue,useReducedMotion,useSpring,useTransform} from "motion/react";
import * as M from "motion/react-m";

type Glow="tom"|"blu"|"yel"|"plum";
type Props={children:ReactNode;glow?:Glow;scale?:number;tilt?:boolean;className?:string;label?:string};

/** Pointer-driven 3D tilt shared by both frames. Touch and reduced-motion users get a still device. */
function useTilt(enabled:boolean,max:number){
 const reduce=useReducedMotion();
 const ref=useRef<HTMLDivElement>(null);
 const px=useMotionValue(0),py=useMotionValue(0);
 const spring={stiffness:130,damping:17,mass:.6};
 const rotateX=useSpring(useTransform(py,[-.5,.5],[max*.7,-max*.7]),spring);
 const rotateY=useSpring(useTransform(px,[-.5,.5],[-max,max]),spring);
 const glare=useTransform(px,[-.5,.5],["-30%","130%"]);
 const active=enabled&&!reduce;
 return {
  ref,rotateX,rotateY,glare,
  onPointerMove:(e:PointerEvent<HTMLDivElement>)=>{
   if(!active||e.pointerType==="touch"||!ref.current)return;
   const r=ref.current.getBoundingClientRect();
   px.set((e.clientX-r.left)/r.width-.5);py.set((e.clientY-r.top)/r.height-.5);
  },
  onPointerLeave:()=>{px.set(0);py.set(0)}
 };
}

function sizeVars(scale?:number):CSSProperties|undefined{
 return scale===undefined?undefined:({"--k":scale} as CSSProperties);
}

/** Titanium phone, 390x844 screen. All dimensions are authored at k=1 and scaled with --k. */
export function PhoneFrame({children,glow="tom",scale,tilt=true,className="",label}:Props){
 const t=useTilt(tilt,9);
 return <div className={"tp-phone-wrap "+className} data-glow={glow} style={sizeVars(scale)}
   {...(label?{role:"img","aria-label":label}:{"aria-hidden":true})}>
  <M.div ref={t.ref} className="tp-phone-tilt" style={{rotateX:t.rotateX,rotateY:t.rotateY}}
    onPointerMove={t.onPointerMove} onPointerLeave={t.onPointerLeave}>
   <div className="tp-phone">
    <i className="tp-pbtn tp-pbtn-action"/><i className="tp-pbtn tp-pbtn-up"/><i className="tp-pbtn tp-pbtn-down"/><i className="tp-pbtn tp-pbtn-power"/>
    <div className="tp-bezel">
     <div className="tp-screen">
      {children}
      <i className="tp-island"><b/></i>
      <M.i className="tp-glare" style={{left:t.glare}}/>
     </div>
    </div>
   </div>
  </M.div>
  <i className="tp-ground"/>
 </div>;
}

/** Aluminium laptop, 1280x800 screen. */
export function LaptopFrame({children,glow="blu",scale,tilt=true,className="",label}:Props){
 const t=useTilt(tilt,5);
 return <div className={"tp-lap-wrap "+className} data-glow={glow} style={sizeVars(scale)}
   {...(label?{role:"img","aria-label":label}:{"aria-hidden":true})}>
  <M.div ref={t.ref} className="tp-lap-tilt" style={{rotateX:t.rotateX,rotateY:t.rotateY}}
    onPointerMove={t.onPointerMove} onPointerLeave={t.onPointerLeave}>
   <div className="tp-laptop">
    <div className="tp-lid">
     <div className="tp-lid-screen">
      {children}
      <M.i className="tp-glare" style={{left:t.glare}}/>
     </div>
     <i className="tp-lid-cam"/>
    </div>
    <div className="tp-lap-base"><i/></div>
   </div>
  </M.div>
  <i className="tp-ground"/>
 </div>;
}
