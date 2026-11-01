/**
 * The containers of a host's content in an embedded root. The content stays
 * the host's: the layout places it and never reaches into it.
 */

import { useLayoutEffect, useRef } from "react";
import type { CSSProperties, ReactNode, Ref } from "react";

/** The slots of an embedded root that hold host content in the layout. */
export type HostSlotName =
  | "emptyState"
  | "railEnd"
  | "railStart"
  | "sidePanel"
  | "stageOverlay"
  | "topBarEnd"
  | "topBarStart";

/** A slot container, named by `data-mokly-slot`. */
export function HostSlot({
  children,
  hidden,
  name,
  ref,
  style,
}: {
  children?: ReactNode;
  hidden?: boolean | undefined;
  name: HostSlotName;
  ref?: Ref<HTMLDivElement> | undefined;
  style?: CSSProperties | undefined;
}) {
  return (
    <div data-mokly-slot={name} hidden={hidden} ref={ref} style={style}>
      {children}
    </div>
  );
}

/** The host's content over the shown preview. */
export interface StageOverlayContent {
  content: ReactNode;
  /** Whether the content takes the pointer from the preview below it. */
  pointerEvents: "auto" | "none";
}

/** The preview surfaces that an overlay covers, in the order of the search. */
const STAGE_SELECTOR = "[data-workspace-preview], .mbk-flow, .mbk-stage-embed";

/**
 * The stage overlay slot. It covers the shown preview surface of its stage
 * host, and it hides while the host gives no content or no preview shows. It
 * measures after each render and whenever the stage host or the preview
 * resizes.
 */
export function StageOverlay({
  value,
}: {
  value?: StageOverlayContent | undefined;
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
    <HostSlot
      hidden
      name="stageOverlay"
      ref={overlay}
      style={{ pointerEvents: value?.pointerEvents ?? "none" }}
    >
      {value?.content}
    </HostSlot>
  );
}
