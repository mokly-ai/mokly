import type { NavigationState } from "../../../parts/navigation_states.js";

import {
  EVIDENCE_PAGES as E,
  type EvidenceDestination,
} from "./destinations.js";

/**
 * An artboard whose Fit refits its own frames and whose dock opens its own
 * panel sheet, which a phone shows open, with its other transitions.
 */
const fitted = (
  design: EvidenceDestination,
  {
    canvas = {},
    ...filters
  }: Pick<NavigationState, "all" | "canvas" | "changes"> = {},
): NavigationState => ({
  ...filters,
  canvas: { ...canvas, fit: design, panelSheet: design },
});

/**
 * The authored transitions of the Comparison evidence artboards.
 * `../../parts/navigation_states.ts` spreads them into the family's states.
 * Each depicted branch is a story of its own. On the branch whose changed
 * stylesheet applies to Welcome, the matched styles in Changes and the
 * excluded styles in All open each other through the catalogue's filter,
 * and each shows its own compare mode. The page's two tabs open each other.
 * No artboard shows these entries zoomed, in another mode, on another tab,
 * or with the sheet closed, so those controls are pictures.
 */
export const EVIDENCE_NAVIGATION_STATES = {
  [E.evidenceStyles]: fitted(E.evidenceStyles, {
    all: E.evidenceStylesExcluded,
  }),
  [E.evidenceStylesUnresolved]: fitted(E.evidenceStylesUnresolved),
  [E.evidenceStylesUnnamed]: fitted(E.evidenceStylesUnnamed),
  [E.evidenceStylesExcluded]: fitted(E.evidenceStylesExcluded, {
    changes: E.evidenceStyles,
  }),
  [E.evidenceUnchanged]: fitted(E.evidenceUnchanged),
  [E.evidenceUnchangedAction]: fitted(E.evidenceUnchangedAction),
  [E.evidencePage]: fitted(E.evidencePage, {
    canvas: { inspectTab: E.evidencePageInspect },
  }),
  [E.evidencePageInspect]: fitted(E.evidencePageInspect, {
    canvas: { changesTab: E.evidencePage },
  }),
  [E.evidenceIgnored]: fitted(E.evidenceIgnored),
} satisfies Record<EvidenceDestination, NavigationState>;
