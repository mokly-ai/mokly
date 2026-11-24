import { defineScreen } from "@mokly/mokly";

import {
  artboardStates,
  type ArtboardViewport,
} from "../../parts/artboards.js";
import type { PanelTab } from "../parts/panel.js";
import { FITS } from "../parts/sketches.js";

import { OUTCOME_PAGES as O } from "./parts/destinations.js";
import { removedMetadata, removedState } from "./parts/metadata.js";
import { PreviousArtboard } from "./parts/removed_artboard.js";
import { ONLY_STEP, VARIANT_CHANGES } from "./parts/removed_branches.js";
import { REMOVED_VARIANT_RECORD } from "./parts/removed_entries.js";
import { RemovedChanges, RemovedScreenInspect } from "./parts/removed_panel.js";
import { saveFailedFrames } from "./parts/removed_sketches.js";

/**
 * Welcome's variants in Inspect: the removed Save failed stays after the
 * current variants, checked. No artboard of this branch shows Welcome or
 * Empty workspace, so their rows are pictures.
 */
const VARIANTS = [
  { label: "Welcome" },
  { label: "Empty workspace" },
  {
    label: "Save failed · Removed",
    current: true,
    to: O.removedVariantInspect,
  },
] as const;

/**
 * Welcome's saved variant Save failed, which a branch of its own removed,
 * selected from its Removed row under Welcome. It rendered in both schemes,
 * so its previous version stands as four frames, Light above Dark. A phone
 * opens the panel sheet at the artboard's tab.
 */
function SaveFailed({
  tab,
  viewport,
}: {
  tab: PanelTab;
  viewport: ArtboardViewport;
}) {
  const inspect = tab === "inspect";
  return (
    <PreviousArtboard
      catalogue={VARIANT_CHANGES}
      compactZoom={FITS.phone}
      design={inspect ? O.removedVariantInspect : O.removedVariant}
      frames={saveFailedFrames()}
      panel={
        inspect ? (
          <RemovedScreenInspect
            frames={{ count: 4, lightOnly: false }}
            record={REMOVED_VARIANT_RECORD}
            variants={VARIANTS}
          />
        ) : (
          <RemovedChanges step={ONLY_STEP} />
        )
      }
      record={REMOVED_VARIANT_RECORD}
      sheet="panel"
      tab={tab}
      viewport={viewport}
      zoom={FITS.welcome}
    />
  );
}

export const canvasRemovedVariantScreen = defineScreen({
  ...removedMetadata,
  relatedDocs: [
    ...removedMetadata.relatedDocs,
    "docs/protocol/mokly-variant-navigation.md",
  ],
  description:
    "Welcome's saved variant Save failed, which the branch removed, keeps a Removed row under its surviving parent and opens its previous version as four frames, Light above Dark. Its Changes tab offers no compare mode, and a phone opens it in the panel sheet.",
  ...artboardStates(
    {
      state: "changes",
      title: "Changes",
      desktop: <SaveFailed tab="changes" viewport="desktop" />,
      mobile: <SaveFailed tab="changes" viewport="mobile" />,
    },
    [
      removedState(
        "inspect",
        "Inspect",
        "Save failed's Inspect: Welcome's variants list it after the current ones, its Frames filter shows both schemes, and Highlight components is unavailable. On a phone, the panel sheet is open.",
        (viewport) => <SaveFailed tab="inspect" viewport={viewport} />,
      ),
    ],
  ),
  slug: "removed-variant",
  rationale:
    "A removed variant is its own Removed entry and leaves its parent in place, so it keeps its row under the parent that still exists and opens like a screen, as its historical frames.",
  title: "Removed screen variant",
});
