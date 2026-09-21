/** One side-effect-free decision for activating a row while Changes is selected. */
import type { ColorScheme, Viewport } from "../data/axes.js";
import { orderChangedViews, type ChangedView } from "../shell/view_marks.js";

import { changesFilterSelected, changesLandingHref } from "./browse_landing.js";

/** Effective destination and optional first-changed-view axes. */
export interface ChangesActivation {
  href: string;
  viewport?: Viewport;
  scheme?: ColorScheme;
}

/** Resolve a changed row or aggregate-only parent without mutating shell state. */
export function changesActivation(
  row: Element,
  destinationChangedViews: readonly ChangedView[] = [],
): ChangesActivation | undefined {
  const doc = row.ownerDocument;
  if (!doc || !row.hasAttribute("data-nav-row") || !changesFilterSelected(doc))
    return undefined;
  const redirected = changesLandingHref(row);
  if (row.getAttribute("data-changed") !== "true" && redirected === undefined)
    return undefined;
  const href = redirected ?? row.getAttribute("href") ?? undefined;
  if (href === undefined) return undefined;
  const first = orderChangedViews(destinationChangedViews)[0];
  if (!first) return { href };
  try {
    const url = new URL(href, "https://mokly.invalid");
    if (url.searchParams.has("viewport") || url.searchParams.has("scheme"))
      return { href };
  } catch {
    return { href };
  }
  return {
    href,
    viewport: first.viewport,
    scheme: first.colorScheme,
  };
}
