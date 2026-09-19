/** Preview-bounded host overlay for an embedded viewer shell. */

import { useLayoutEffect, useRef } from "react";

import type { ViewerSlots } from "../viewer/types.js";

const STAGE_SELECTOR = "[data-workspace-preview], .mbk-flow, .mbk-stage-embed";

/** Keep ordinary React slot content inside the current preview surface. */
export function EmbeddedStageOverlay({
  value,
}: {
  value?: ViewerSlots["stageOverlay"];
}) {
  const overlay = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = overlay.current;
    const host = element?.parentElement;
    if (!element || !host || !value) {
      if (element) element.hidden = true;
      return;
    }
    const stage = host.querySelector<HTMLElement>(STAGE_SELECTOR);
    if (!stage) {
      element.hidden = true;
      return;
    }
    const update = () => {
      const bounds = stage.getBoundingClientRect();
      const parent = host.getBoundingClientRect();
      Object.assign(element.style, {
        height: `${bounds.height}px`,
        left: `${bounds.left - parent.left}px`,
        top: `${bounds.top - parent.top}px`,
        width: `${bounds.width}px`,
      });
      element.hidden = false;
    };
    const resize = new ResizeObserver(update);
    resize.observe(host);
    resize.observe(stage);
    update();
    return () => resize.disconnect();
  });
  return (
    <div
      data-mokly-slot="stageOverlay"
      hidden
      ref={overlay}
      style={{ pointerEvents: value?.pointerEvents ?? "none" }}
    >
      {value?.content}
    </div>
  );
}
