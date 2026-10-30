/** Pick listeners and their measured regions; consumer DOM remains unchanged. */
import type { ComponentViewRecord } from "../components/manifest_types.js";

import {
  authenticateRanges,
  rangeBounds,
  type ComponentBounds,
} from "./component_geometry.js";

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
  const measurements: (() => void)[] = [];
  const schedule = () => {
    if (!pending)
      pending = win.requestAnimationFrame(() => {
        pending = 0;
        for (const measure of measurements) measure();
      });
  };
  for (const entry of frames) {
    const { frame, usage } = entry;
    const authenticated = authenticateRanges(frame, entry.path, usage);
    if (!authenticated) continue;
    let bounds: ComponentBounds[] = [];
    const measure = () => {
      bounds = rangeBounds(frame, authenticated, keys);
    };
    measurements.push(measure);
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
