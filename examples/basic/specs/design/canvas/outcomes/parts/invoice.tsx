import { ENTRY_PATHS } from "../../../parts/entry_paths.js";
import { MiniInvoice } from "../../../parts/mini_invoice.js";
import type { CanvasEntry } from "../../parts/entries.js";
import { compareFrames, screenFrames } from "../../parts/frames.js";
import { FITS } from "../../parts/sketches.js";

/**
 * Invoice, which the canonical branch moved under Account with edits. A
 * moved entry carries no status pill: its Changes row names the move.
 */
export const INVOICE = {
  title: "Invoice",
  slug: "invoice",
  path: ENTRY_PATHS.invoice,
  kind: "screen",
  changed: true,
} as const satisfies CanvasEntry;

/**
 * Invoice renders in Light only, so its section holds the Light row alone,
 * Desktop beside Mobile, which fits at the zoom of Profile's Light row.
 */
export const INVOICE_FIT = FITS.profile;

/** Invoice's current version on its Light frames. */
export function invoiceFrames() {
  return screenFrames(
    (viewport) => <MiniInvoice compact={viewport === "mobile"} revised />,
    ["light"],
  );
}

/**
 * Overlay on Invoice's Light frames: each frame holds the version at its
 * previous path under the current version, at the frame's one size. The
 * revision rewords the due date and the action in place, so every other
 * line keeps its position in both versions.
 */
export function invoiceOverlayFrames() {
  return compareFrames(
    (viewport, _scheme, version) => (
      <MiniInvoice
        compact={viewport === "mobile"}
        revised={version === "after"}
      />
    ),
    "overlay",
  ).filter((frame) => frame.scheme === "light");
}
