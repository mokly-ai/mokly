/** Accessible React-owned desktop navigation split separator. */

import { useRef } from "react";

import { useOptionalShellStore } from "./store_context.js";

/** Pointer- and keyboard-operable navigation resize handle. */
export function NavigationResizeHandle() {
  const store = useOptionalShellStore();
  const drag = useRef<
    { pointer: number; start: number; width: number } | undefined
  >(undefined);
  const width = store?.state.navigationWidth ?? 248;
  const currentWidth = useRef(width);
  currentWidth.current = width;

  const finish = (handle: HTMLDivElement, pointer: number) => {
    if (drag.current?.pointer !== pointer) return;
    drag.current = undefined;
    document.body.classList.remove("mbk-nav-resizing");
    if (handle.hasPointerCapture(pointer))
      handle.releasePointerCapture(pointer);
    store?.persistNavigationWidth(currentWidth.current);
  };
  return (
    <div
      aria-label="Resize navigation panel"
      aria-orientation="vertical"
      aria-valuemax={store?.state.navigationMaximum ?? 480}
      aria-valuemin={192}
      aria-valuenow={width}
      aria-valuetext={`${width} pixels`}
      className="mbk-nav-resize"
      data-mokly-nav-resize=""
      onDoubleClick={() => {
        store?.setNavigationWidth(248);
        store?.persistNavigationWidth(248);
      }}
      onKeyDown={(event) => {
        if (!store) return;
        let next: number | undefined;
        if (event.key === "ArrowLeft") next = width - 16;
        if (event.key === "ArrowRight") next = width + 16;
        if (event.key === "Home") next = 192;
        if (event.key === "End") next = store.state.navigationMaximum;
        if (next === undefined) return;
        event.preventDefault();
        store.setNavigationWidth(next);
        store.persistNavigationWidth(next);
      }}
      onLostPointerCapture={(event) =>
        finish(event.currentTarget, event.pointerId)
      }
      onPointerCancel={(event) => finish(event.currentTarget, event.pointerId)}
      onPointerDown={(event) => {
        if (!store || !event.isPrimary || event.button !== 0) return;
        event.preventDefault();
        drag.current = {
          pointer: event.pointerId,
          start: event.clientX,
          width,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        document.body.classList.add("mbk-nav-resizing");
      }}
      onPointerMove={(event) => {
        const active = drag.current;
        if (!store || active?.pointer !== event.pointerId) return;
        const next = active.width + event.clientX - active.start;
        currentWidth.current = Math.round(
          Math.max(192, Math.min(store.state.navigationMaximum, next)),
        );
        store.setNavigationWidth(next);
      }}
      onPointerUp={(event) => finish(event.currentTarget, event.pointerId)}
      role="separator"
      tabIndex={0}
      title="Drag to resize. Use arrow keys for precise control."
    />
  );
}
