/** Accessible inspector divider and mobile sheet sizing owned by React. */

import { useEffect, type RefObject } from "react";

/** Install scoped pointer, keyboard, and resize behavior for one inspector. */
export function useInspectorResize(
  root: RefObject<HTMLElement | null>,
  interactive: boolean,
): void {
  useEffect(() => {
    const workspace = root.current;
    if (!interactive || !workspace) return;
    const win = workspace.ownerDocument.defaultView;
    const inspector = workspace.querySelector<HTMLElement>(
      "[data-workspace-inspector]",
    );
    const divider = workspace.querySelector<HTMLElement>(
      "[data-inspector-resize]",
    );
    const grab = workspace.querySelector<HTMLButtonElement>(
      "[data-inspector-size]",
    );
    const panes = workspace.querySelector<HTMLElement>(".mbk-workspace-panes");
    const shell = workspace.closest<HTMLElement>("[data-mokly-shell]");
    if (!win || !inspector || !divider || !grab || !panes || !shell) return;
    const controller = new AbortController();
    const { signal } = controller;
    let height = 260;
    let drag:
      | { pointer: number; y: number; height: number; moved: boolean }
      | undefined;
    let suppressClick = false;
    const narrow = () => win.matchMedia("(max-width: 56.25rem)").matches;
    const bounds = () => ({
      min: Math.min(160, panes.clientHeight - 100),
      max: Math.max(46, panes.clientHeight - 100),
    });
    const clamp = () => {
      const { min, max } = bounds();
      const minimum = Math.max(46, min);
      height = Math.min(max, Math.max(minimum, height));
      inspector.style.setProperty("--inspector-height", `${height}px`);
      divider.setAttribute("aria-valuemin", String(minimum));
      divider.setAttribute("aria-valuemax", String(max));
      divider.setAttribute("aria-valuenow", String(Math.round(height)));
    };
    const expand = (value: boolean) => {
      inspector.dataset["expanded"] = String(value);
      grab.setAttribute("aria-expanded", String(value));
      grab.setAttribute(
        "aria-label",
        value ? "Make inspector compact" : "Expand inspector",
      );
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
      shell.classList.add("mbk-inspector-resizing");
    };
    const move = (event: PointerEvent) => {
      if (!drag || drag.pointer !== event.pointerId) return;
      const delta = drag.y - event.clientY;
      drag.moved ||= Math.abs(delta) > 5;
      if (narrow())
        inspector.style.height = `${Math.min(
          panes.clientHeight - 36,
          Math.max(190, drag.height + delta),
        )}px`;
      else {
        height = drag.height + delta;
        clamp();
      }
    };
    const end = (event: PointerEvent) => {
      if (!drag || drag.pointer !== event.pointerId) return;
      if (narrow() && drag.moved) expand(drag.y - event.clientY > 0);
      suppressClick = drag.moved;
      inspector.style.removeProperty("height");
      drag = undefined;
      shell.classList.remove("mbk-inspector-resizing");
    };
    for (const handle of [divider, grab]) {
      handle.addEventListener("pointerdown", begin, { signal });
      handle.addEventListener("pointermove", move, { signal });
      handle.addEventListener("pointerup", end, { signal });
      handle.addEventListener("pointercancel", end, { signal });
      handle.addEventListener("lostpointercapture", end, { signal });
    }
    grab.addEventListener(
      "click",
      () => {
        if (!suppressClick) expand(inspector.dataset["expanded"] !== "true");
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
      shell.classList.remove("mbk-inspector-resizing");
    };
  }, [interactive, root]);
}
