"use client";

import { useEffect, useState } from "react";
import { SAMPLE_START } from "./sample-price-data";

/** A gently moving sample price so the hero can be reviewed. Never used outside /design-system. */
export function useSamplePrice(intervalMs = 4000) {
  // Server and first client render both start from SAMPLE_START, so they match.
  const [price, setPrice] = useState<{ usdPerOz: number; usdPhp: number }>(SAMPLE_START);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPrice((p) => {
        const drift = (Math.random() - 0.48) * 0.0012; // ±0.12% per tick
        return { usdPerOz: +(p.usdPerOz * (1 + drift)).toFixed(2), usdPhp: p.usdPhp };
      });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return price;
}
