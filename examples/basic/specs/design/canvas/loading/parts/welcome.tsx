import { MiniWelcome } from "../../../parts/mini_screens.js";
import { miniView } from "../../../parts/mini_views.js";
import { CANVAS_ENTRIES, type CanvasEntry } from "../../parts/entries.js";
import { screenFrames } from "../../parts/frames.js";

/**
 * Welcome while the catalogue holds no comparison result: the comparison
 * still runs, failed, found no change, or was not built. The entry then
 * carries no change status, so its section names no status and its right
 * panel has the Inspect tab alone.
 */
export const WELCOME_UNCLASSIFIED: CanvasEntry = {
  ...CANVAS_ENTRIES.welcome,
  status: undefined,
  changed: false,
};

/** Welcome's saved variants, in Inspect's list, with Welcome shown. */
export const WELCOME_VARIANTS = [
  { label: "Welcome", current: true },
  { label: "Empty workspace" },
  { label: "Save failed" },
] as const;

/**
 * Welcome's four frames on a branch without changes, where Welcome is the
 * version of the branch point, without the introduction that the canonical
 * branch adds. Its link stays inert, because Canvas links stay inside the
 * Canvas family.
 */
export function unrevisedWelcomeFrames() {
  return screenFrames((viewport) => (
    <MiniWelcome compact={viewport === "mobile"} inert />
  ));
}

/** The depicted view of the unrevised Welcome, whose instances it highlights. */
export const UNREVISED_WELCOME_VIEW = miniView("welcome");
