/** Accessible inspector divider and mobile sheet sizing owned by React. */

import { useEffect, useRef, useState, type RefObject } from "react";

import type { InspectorHandle, InspectorSizing } from "@mokly/ui/inspector";

import { NARROW_SHELL } from "./layout_breakpoint.js";
import { useShellRoot } from "./root_context.js";

/** Install scoped pointer, keyboard, and resize behavior for one inspector. */
export function useInspectorResize(
  handle: RefObject<InspectorHandle | null>,
  panesRef: RefObject<HTMLDivElement | null>,
  interactive: boolean,
) {
  const resizeRef = useRef<HTMLDivElement>(null);
  const grabRef = useRef<HTMLButtonElement>(null);
  const [size, setSize] = useState<InspectorSizing>({ expanded: false });
  const setResizing = useShellRoot()?.setResizing;
  useEffect(() => {
    const inspector = handle.current?.element;
    const win = inspector?.ownerDocument.defaultView;
    const divider = resizeRef.current;
    const grab = grabRef.current;
    const panes = panesRef.current;
    if (!interactive || !win || !inspector || !divider || !grab || !panes)
      return;
    const controller = new AbortController();
    const { signal } = controller;
    let height = 260;
    let drag:
      | { pointer: number; y: number; height: number; moved: boolean }
      | undefined;
    let suppressClick = false;
    const narrow = () => win.matchMedia(NARROW_SHELL).matches;
    const bounds = () => ({
      min: Math.min(160, panes.clientHeight - 100),
      max: Math.max(46, panes.clientHeight - 100),
    });
    const clamp = () => {
      const { min, max } = bounds();
      const minimum = Math.max(46, min);
      height = Math.min(max, Math.max(minimum, height));
      setSize((current) => ({
        ...current,
        height,
        minimumHeight: minimum,
        maximumHeight: max,
      }));
    };
    const expand = (value: boolean) => {
      setSize((current) => ({ ...current, expanded: value }));
    };
    const begin = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.currentTarget as HTMLElement;
      drag = {
        pointer: event.pointerId,
        y: event.clientY,
        height: inspector.getBoundingClientRect().height,
        moved: false,
      };
      target.setPointerCapture(event.pointerId);
      if (narrow()) return;
      event.preventDefault();
      setResizing?.("inspector");
    };
    const move = (event: PointerEvent) => {
      if (!drag || drag.pointer !== event.pointerId) return;
      const delta = drag.y - event.clientY;
      drag.moved ||= Math.abs(delta) > 5;
      if (narrow()) {
        const sheetHeight = Math.min(
          panes.clientHeight - 36,
          Math.max(190, drag.height + delta),
        );
        setSize((current) => ({ ...current, sheetHeight }));
      } else {
        height = drag.height + delta;
        clamp();
      }
    };
    const end = (event: PointerEvent) => {
      if (!drag || drag.pointer !== event.pointerId) return;
      if (narrow() && drag.moved) expand(drag.y - event.clientY > 0);
      suppressClick = drag.moved;
      setSize((current) => ({ ...current, sheetHeight: undefined }));
      drag = undefined;
      setResizing?.(undefined);
    };
    const handles: HTMLElement[] = [divider, grab];
    for (const handle of handles) {
      handle.addEventListener("pointerdown", begin, { signal });
      handle.addEventListener("pointermove", move, { signal });
      handle.addEventListener("pointerup", end, { signal });
      handle.addEventListener("pointercancel", end, { signal });
      handle.addEventListener("lostpointercapture", end, { signal });
    }
    grab.addEventListener(
      "click",
      () => {
        if (!suppressClick)
          setSize((current) => ({ ...current, expanded: !current.expanded }));
        suppressClick = false;
      },
      { signal },
    );
    divider.addEventListener(
      "keydown",
      (event) => {
        if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key))
          return;
        event.preventDefault();
        height =
          event.key === "Home"
            ? bounds().min
            : event.key === "End"
              ? bounds().max
              : height + (event.key === "ArrowUp" ? 20 : -20);
        clamp();
      },
      { signal },
    );
    const observer = new ResizeObserver(clamp);
    observer.observe(panes);
    clamp();
    return () => {
      controller.abort();
      observer.disconnect();
      setResizing?.(undefined);
    };
  }, [handle, interactive, panesRef, setResizing]);
  return { ...size, resizeRef, grabRef };
}
