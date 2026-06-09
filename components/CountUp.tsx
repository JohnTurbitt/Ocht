"use client";

import { useEffect, useRef, useState } from "react";

type CountUpProps = {
  value: number;
  format?: (value: number) => string;
  durationMs?: number;
  className?: string;
};

// Smoothly animates a number toward `value`. Used for the 0-100 scores so the
// report feels alive on reveal; intentionally not used on live-updating times.
export function CountUp({
  value,
  format = (current) => String(Math.round(current)),
  durationMs = 700,
  className,
}: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const from = fromRef.current;
    const to = value;
    fromRef.current = value;

    if (reduceMotion || from === to) {
      setDisplay(to);
      return;
    }

    let frame = 0;
    let start: number | null = null;

    function tick(now: number) {
      if (start === null) {
        start = now;
      }

      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);

      setDisplay(from + (to - from) * eased);

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    }

    frame = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frame);
  }, [value, durationMs]);

  return <span className={className}>{format(display)}</span>;
}
