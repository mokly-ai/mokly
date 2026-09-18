/** Parent-owned masks and selection listeners; consumer DOM remains unchanged. */
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
  selected: string | undefined,
  label: ((key: string) => string) | undefined,
  select: (key: string, viewport: "mobile" | "desktop") => void,
  exit: () => void,
  requestedKeys?: ReadonlySet<string>,
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
    (root.matches(".mokly-viewer") ? root : doc.body).append(layer);
    cleanups.push(() => layer.remove());
    const keys =
      requestedKeys ??
      new Set(
        usage.instances
          .filter((instance) =>
            selected
              ? instance.key === selected
              : instance.owner.kind === "entry",
          )
          .map((instance) => instance.key),
      );
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
      const labels: HTMLButtonElement[] = [];
      const seen = new Set<string>();
      for (const box of bounds) {
        const x =
          rect.left + (box.x + frame.clientLeft) * scaleX - visible.left;
        const y = rect.top + (box.y + frame.clientTop) * scaleY - visible.top;
        const w = box.width * scaleX;
        const h = box.height * scaleY;
        overlay.cutout(x, y, w, h);
        if (
          label &&
          !seen.has(box.key) &&
          x + w > 0 &&
          y + h > 0 &&
          x < width &&
          y < height
        ) {
          const button = doc.createElement("button");
          button.type = "button";
          button.className = "mbk-highlight-label";
          button.textContent = label(box.key);
          button.dataset["instanceKey"] = box.key;
          button.style.left = `${Math.max(0, Math.min(width - 40, x))}px`;
          button.style.top = `${Math.max(0, Math.min(height - 22, y - 22))}px`;
          button.addEventListener("click", () =>
            select(box.key, usage.viewport),
          );
          labels.push(button);
          seen.add(box.key);
        }
      }
      const focusedKey = layer.contains(doc.activeElement)
        ? (doc.activeElement as HTMLElement)?.dataset["instanceKey"]
        : undefined;
      layer.replaceChildren(overlay.svg, ...labels);
      if (focusedKey)
        labels
          .find((button) => button.dataset["instanceKey"] === focusedKey)
          ?.focus({ preventScroll: true });
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
