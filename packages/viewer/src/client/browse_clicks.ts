/**
 * The one delegated click path of the Browse shell. Each handler claims the
 * event or declines it, in the order the chrome nests: tag controls, the
 * details bar, the id chip, the navigation and preview controls, embedded
 * frames, the address bar, and finally an ordinary catalogue link. Only the
 * last one navigates, and only that one records where a Changes-filter
 * activation is heading so the destination can open on a changed view.
 */

import { handleBrowseControl } from "./browse_controls.js";
import { handleAddressClick, handleFrameClick } from "./browse_frames.js";
import {
  changesLandingHref,
  rememberChangesLanding,
} from "./browse_landing.js";
import { browseLinkTarget } from "./browse_links.js";
import { copyText } from "./clipboard.js";
import { handleTagControlClick } from "./tag_filter.js";

/** Side effects the delegated click path hands back to Browse. */
export interface BrowseClickActions {
  announce(message: string): void;
  navigate(url: string): void;
  rememberDetails(details: HTMLDetailsElement): void;
  rememberDisclosures(): void;
  updateDiffs(): void;
}

export function handleBrowseClick(
  doc: Document,
  win: Window & typeof globalThis,
  event: MouseEvent,
  actions: BrowseClickActions,
): void {
  const target = event.target instanceof Element ? event.target : undefined;
  if (!target) return;
  if (handleTagControlClick(doc, target)) return;
  const details = target.closest("summary")?.parentElement;
  if (
    details instanceof HTMLDetailsElement &&
    details.matches("[data-mokly-details]")
  )
    actions.rememberDetails(details);
  const idChip = target.closest<HTMLElement>("button[data-copy-id]");
  if (idChip) {
    const id = idChip.dataset["copyId"] ?? "";
    if (id !== "") {
      copyText(doc, id);
      actions.announce(`Copied ID ${id}`);
    }
    return;
  }
  if (
    handleBrowseControl(doc, target, {
      rememberDisclosures: actions.rememberDisclosures,
      updateDiffs: actions.updateDiffs,
    })
  )
    return;
  if (handleFrameClick(doc, target)) {
    event.preventDefault();
    return;
  }
  if (handleAddressClick(doc, target, (text) => copyText(doc, text))) {
    event.preventDefault();
    return;
  }
  const url = browseLinkTarget(event, target, win.location);
  if (!url) return;
  event.preventDefault();
  const anchor = target.closest("a");
  const landing = anchor ? changesLandingHref(anchor) : undefined;
  const destination =
    landing === undefined ? url : new URL(landing, win.location.href).href;
  if (anchor) rememberChangesLanding(win, anchor, destination);
  actions.navigate(destination);
}
