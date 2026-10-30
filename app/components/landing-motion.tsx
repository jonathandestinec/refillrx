"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export default function LandingMotion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const elements = root.querySelectorAll<HTMLElement>("[data-reveal]");
    if (!elements.length || !("IntersectionObserver" in window)) return;

    root.dataset.motionReady = "true";
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (entry.target instanceof HTMLElement) entry.target.dataset.revealed = "true";
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -32px 0px" },
    );

    elements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
      delete root.dataset.motionReady;
    };
  }, []);

  return <div className="landing-motion-root" ref={rootRef}>{children}</div>;
}
