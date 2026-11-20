import type { Owner } from "../app-regions";

export const viewerStageOwners = {
  // Milestone 13 resolves the publication, so the one card the stage draws is
  // chosen in `stage-view.tsx` and drawn by `stage.tsx`; the route composes
  // them rather than writing their copy itself.
  "product/viewer/standalone": {
    region: "stage",
    files: ["viewer/stage.tsx", "viewer/stage-view.tsx"],
  },
  // The sentence a failed read announces is chosen in `stage-view.tsx` and
  // handed to the card `stage.tsx` draws, so both answer for this page. The
  // three pages above name only `stage.tsx`, because every card they draw
  // writes its own words there.
  "product/viewer/standalone/unreadable": {
    region: "stage",
    files: ["viewer/stage.tsx", "viewer/stage-view.tsx"],
  },
  "product/viewer/standalone/reader": {
    region: "stage",
    files: ["viewer/stage.tsx"],
  },
  // The same branch in a project the free plan publishes nothing to. The card
  // is the stage's own, like every other one it draws for a branch with no
  // publication, including the owner's way on to Billing.
  "product/viewer/standalone/plan": {
    region: "stage",
    files: ["viewer/stage.tsx", "components/plan-consequence.tsx"],
  },
  // The same card read by everyone who cannot open billing themselves: the
  // switcher is the one control on it, which the stage already writes.
  "product/viewer/standalone/plan-reader": {
    region: "stage",
    files: ["viewer/stage.tsx"],
  },
  // The workspace ownership read that decides who can open Billing failed.
  // Which read failed is decided in `stage-view.tsx` and handed to the card
  // `stage.tsx` draws, so both answer for this page, exactly as they do for the
  // publication read that failed.
  "product/viewer/standalone/workspace-unreadable": {
    region: "stage",
    files: ["viewer/stage.tsx", "viewer/stage-view.tsx"],
  },
} as const satisfies Record<string, Owner>;
