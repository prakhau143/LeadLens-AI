"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";

// Loaded only when it will actually be shown, so phones never download it.
const AiBackgroundCanvas = dynamic(() => import("./ai-background-canvas"), { ssr: false });

/**
 * Backdrop for every page. The CSS layer (`.ai-backdrop`: gradient + faint grid) is always
 * there. The animated canvas is added on top only for wide screens without
 * `prefers-reduced-motion`, and only after the browser is idle, so it can never delay
 * first render or the upload flow.
 */
export function AiBackground() {
  const wide = useMediaQuery("(min-width: 768px)");
  const calm = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 800));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = ric(() => setIdle(true));
    return () => cancel(id as number);
  }, []);

  return (
    <div className="ai-backdrop" aria-hidden="true">
      {wide && !calm && idle && <AiBackgroundCanvas />}
    </div>
  );
}
