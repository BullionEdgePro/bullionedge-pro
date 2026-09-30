"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";

const GoldBarCanvas = dynamic(() => import("@/components/hero/gold-bar"), { ssr: false });

export function BarRender() {
  const progress = useRef(0);
  const [ready, setReady] = useState(false);
  return (
    <>
      <style>{`html,body{background:transparent!important}`}</style>
      <div className="fixed inset-0" data-ready={ready || undefined} id="bar-stage">
        <GoldBarCanvas progress={progress} onReady={() => setReady(true)} />
      </div>
    </>
  );
}
