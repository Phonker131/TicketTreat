"use client";

import {useEffect, useRef, type ReactNode} from "react";

export function EventBookingBar({label, children}: {label: string; children: ReactNode}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = ref.current;
    if (!bar) return;
    const update = () => document.body.style.setProperty(
      "--event-booking-bar-height", `${bar.getBoundingClientRect().height}px`
    );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      document.body.style.removeProperty("--event-booking-bar-height");
    };
  }, []);
  return <div ref={ref} className="ev2-bar" role="region" aria-label={label}>{children}</div>;
}
