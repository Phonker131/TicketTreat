"use client";
import type {ReactNode} from "react";
import {LazyMotion} from "motion/react";

/* The animation engine (drag, layout, exit) loads after first paint instead of blocking it. Components use `M.*` from motion/react-m. */
const loadFeatures=()=>import("@/components/motionFeatures").then(mod=>mod.default);

export function MotionProvider({children}:{children:ReactNode}){
  return <LazyMotion features={loadFeatures} strict>{children}</LazyMotion>;
}
