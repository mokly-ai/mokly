/** Map scroll keys pressed inside a comparison pane onto its shared viewport. */

import type { ScrollOffset } from "./comparison_scroll_mirror.js";

/** CSS pixels one arrow key scrolls, matching the browser's line step. */
export const LINE_STEP = 40;

/** Share of the visible height one page key scrolls, as the browser does. */
const PAGE_FRACTION = 0.875;

/** The key event fields that decide whether and where a pane scrolls. */
export interface ScrollKey {
  altKey: boolean;
  ctrlKey: boolean;
  defaultPrevented: boolean;
  isComposing: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
}

/** The shared viewport's visible size and scroll range. */
export interface ScrollArea {
  height: number;
  range: ScrollOffset;
}

interface TargetElement {
  isContentEditable?: boolean;
  localName?: unknown;
}

const EDITABLE = new Set(["input", "select", "textarea"]);
const SPACE_ACTIVATED = new Set(["button", "summary"]);

function element(target: EventTarget | null): TargetElement | undefined {
  const candidate = target as TargetElement | null;
  return candidate && typeof candidate.localName === "string"
    ? candidate
    : undefined;
}

/** Whether a key belongs to the focused control rather than to scrolling. */
function ownedByTarget(key: string, target: EventTarget | null): boolean {
  const focused = element(target);
  if (!focused) return false;
  if (
    focused.isContentEditable === true ||
    EDITABLE.has(focused.localName as string)
  )
    return true;
  return key === " " && SPACE_ACTIVATED.has(focused.localName as string);
}

function clamp(value: number, maximum: number): number {
  return Math.min(Math.max(value, 0), Math.max(maximum, 0));
}

/** A shared viewport's visible height and scroll range. */
export function scrollArea(viewport: {
  clientHeight: number;
  clientWidth: number;
  scrollHeight: number;
  scrollWidth: number;
}): ScrollArea {
  return {
    height: viewport.clientHeight,
    range: {
      x: viewport.scrollWidth - viewport.clientWidth,
      y: viewport.scrollHeight - viewport.clientHeight,
    },
  };
}

/**
 * The offset a scroll key moves the shared viewport to, or `undefined` when
 * the key is not a scroll key, carries a command modifier, was already
 * handled, or belongs to an editable or Space-activated control.
 */
export function scrollKeyTarget(
  event: ScrollKey,
  current: ScrollOffset,
  area: ScrollArea,
): ScrollOffset | undefined {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    ownedByTarget(event.key, event.target)
  )
    return;
  const page = Math.max(1, Math.floor(area.height * PAGE_FRACTION));
  let { x, y } = current;
  switch (event.key) {
    case " ":
      y += event.shiftKey ? -page : page;
      break;
    case "PageDown":
      y += page;
      break;
    case "PageUp":
      y -= page;
      break;
    case "Home":
      y = 0;
      break;
    case "End":
      y = area.range.y;
      break;
    case "ArrowDown":
      y += LINE_STEP;
      break;
    case "ArrowUp":
      y -= LINE_STEP;
      break;
    case "ArrowRight":
      x += LINE_STEP;
      break;
    case "ArrowLeft":
      x -= LINE_STEP;
      break;
    default:
      return;
  }
  return { x: clamp(x, area.range.x), y: clamp(y, area.range.y) };
}
