/** Parent-owned masks and selection listeners; consumer DOM remains unchanged. */

import { VIEWER_DIRECTORY } from "../catalogue/delivery_paths.js";
import type { ComponentViewRecord } from "../components/manifest_types.js";

import {
  authenticateRanges,
  rangeBounds,
  visibleFrameBox,
  type ComponentBounds,
} from "./component_geometry.js";
import { createOverlay } from "./component_overlay.js";

export interface HighlightFrame {
  frame: HTMLIFrameElement;
  path: string;
  usage: ComponentViewRecord;
}
export function installLocalHighlight(
  root: HTMLElement,
  frames: readonly HighlightFrame[],
  select: (key: string, viewport: "mobile" | "desktop") => void,
  exit: () => void,
  keys: ReadonlySet<string>,
): () => void {
  const doc = root.ownerDocument;
  const win = doc.defaultView!;
  const controller = new AbortController();
  const cleanups: (() => void)[] = [];
  let pending = 0;
  const draws: (() => void)[] = [];
  const schedule = () => {
    if (!pending)
      pending = win.requestAnimationFrame(() => {
        pending = 0;
        for (const draw of draws) draw();
      });
  };
  for (const entry of frames) {
    const { frame, usage } = entry;
    const authenticated = authenticateRanges(frame, entry.path, usage);
    if (!authenticated) continue;
    const layer = doc.createElement("div");
    layer.className = "mbk-highlight-layer";
    layer.dataset["highlightViewport"] = usage.viewport;
    (root.matches(`.${VIEWER_DIRECTORY}`) ? root : doc.body).append(layer);
    cleanups.push(() => layer.remove());
    let bounds: ComponentBounds[] = [];
    const draw = () => {
      const visible = visibleFrameBox(frame);
      layer.hidden = !visible || frame.getClientRects().length === 0;
      if (layer.hidden || !visible) return;
      const rect = frame.getBoundingClientRect();
      const scaleX = rect.width / frame.offsetWidth;
      const scaleY = rect.height / frame.offsetHeight;
      Object.assign(layer.style, {
        left: `${visible.left}px`,
        top: `${visible.top}px`,
        width: `${visible.right - visible.left}px`,
        height: `${visible.bottom - visible.top}px`,
        zIndex: frame.closest(".browser-frame.is-expanded") ? "951" : "4",
      });
      bounds = rangeBounds(frame, authenticated, keys);
      const width = visible.right - visible.left;
      const height = visible.bottom - visible.top;
      const overlay = createOverlay(doc, width, height);
      for (const box of bounds)
        overlay.cutout(
          rect.left + (box.x + frame.clientLeft) * scaleX - visible.left,
          rect.top + (box.y + frame.clientTop) * scaleY - visible.top,
          box.width * scaleX,
          box.height * scaleY,
        );
      layer.replaceChildren(overlay.svg);
    };
    draws.push(draw);
    const activate = (event: MouseEvent) => {
      const match = bounds.find(
        (box) =>
          event.clientX >= box.x &&
          event.clientX <= box.x + box.width &&
          event.clientY >= box.y &&
          event.clientY <= box.y + box.height,
      );
      if (!match) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      select(match.key, usage.viewport);
    };
    authenticated.doc.addEventListener("click", activate, {
      capture: true,
      signal: controller.signal,
    });
    authenticated.doc.addEventListener("auxclick", activate, {
      capture: true,
      signal: controller.signal,
    });
    authenticated.doc.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          exit();
        }
      },
      { signal: controller.signal },
    );
    authenticated.doc.addEventListener("scroll", schedule, {
      capture: true,
      passive: true,
      signal: controller.signal,
    });
    authenticated.doc.addEventListener("load", schedule, {
      capture: true,
      signal: controller.signal,
    });
    authenticated.doc.fonts.addEventListener("loadingdone", schedule, {
      signal: controller.signal,
    });
    const resize = new ResizeObserver(schedule);
    resize.observe(frame);
    if (authenticated.doc.body) resize.observe(authenticated.doc.body);
    cleanups.push(() => resize.disconnect());
    const changes = new MutationObserver(schedule);
    changes.observe(authenticated.doc, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    cleanups.push(() => changes.disconnect());
  }
  doc.addEventListener("scroll", schedule, {
    capture: true,
    passive: true,
    signal: controller.signal,
  });
  win.addEventListener("resize", schedule, { signal: controller.signal });
  schedule();
  return () => {
    controller.abort();
    if (pending) win.cancelAnimationFrame(pending);
    for (const cleanup of cleanups) cleanup();
  };
}
