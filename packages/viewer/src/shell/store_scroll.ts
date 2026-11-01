/** Browser history persistence for shell-owned scroll regions. */

import type { ElementRefs } from "./element_refs.js";
import type { ScrollRegion } from "./root_context.js";

type ScrollRegions = ElementRefs<ScrollRegion, HTMLDivElement> | undefined;

/** Read every named stage or inspector scroll position through its ref. */
export function captureScrolls(regions: ScrollRegions): Record<string, number> {
  return Object.fromEntries(
    (regions?.values() ?? []).map(([name, region]) => [name, region.scrollTop]),
  );
}

/** Restore positions only for regions present in the next route tree. */
export function restoreScrolls(
  regions: ScrollRegions,
  scrolls: Readonly<Record<string, number>>,
): void {
  for (const [name, region] of regions?.values() ?? []) {
    const top = scrolls[name];
    if (top !== undefined) region.scrollTop = top;
  }
}

/** Replace only the scroll payload of the current history entry. */
export function persistScroll(
  win: Window & typeof globalThis,
  scrolls: Readonly<Record<string, number>>,
): void {
  const existing =
    win.history.state && typeof win.history.state === "object"
      ? win.history.state
      : {};
  win.history.replaceState({ ...existing, scrolls }, "", win.location.href);
}

/** Validate the scroll payload read from untrusted browser history state. */
export function historyScrolls(
  value: unknown,
): Readonly<Record<string, number>> {
  if (!value || typeof value !== "object" || !("scrolls" in value)) return {};
  const scrolls = value.scrolls;
  if (!scrolls || typeof scrolls !== "object" || Array.isArray(scrolls))
    return {};
  return Object.fromEntries(
    Object.entries(scrolls).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1]),
    ),
  );
}
