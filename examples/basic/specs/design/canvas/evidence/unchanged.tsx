import { defineScreen } from "@mokly/mokly";

import { artboardStates } from "../../parts/artboards.js";
import { COMPONENT_NAVIGATION } from "../../parts/component_nav_data.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { DETAILS_VIEW, detailsFrames } from "../parts/changes_sketches.js";
import { CANVAS_ENTRIES } from "../parts/entries.js";
import { actionFrames } from "../parts/set_sketches.js";
import { VariantSetArtboard } from "../parts/set_stage.js";
import { CanvasShell } from "../parts/shell.js";
import { FITS } from "../parts/sketches.js";
import { CanvasStage } from "../parts/stage.js";

import { EVIDENCE_ENTRIES, quietAll, stylesAll } from "./parts/branches.js";
import { EVIDENCE_PAGES as E } from "./parts/destinations.js";
import { ExcludedOnlyInspect } from "./parts/inspect.js";
import { ActionExcludedInspect } from "./parts/inspect_entries.js";
import { evidenceMetadata, evidenceState } from "./parts/metadata.js";

/**
 * Details on the branch of Changed styles, opened from All: it links only
 * the stylesheet whose changed styles apply nowhere on it, so it stays out of
 * Changes, names no status, and its right panel has Inspect alone, which
 * keeps the evidence after the head. On a phone, the Inspect sheet is open at
 * its expanded height.
 */
function ExcludedOnly({ viewport }: { viewport: ArtboardViewport }) {
  const entry = EVIDENCE_ENTRIES.details;
  return (
    <CanvasShell
      catalogue={stylesAll("details")}
      compactZoom={FITS.phone}
      design={E.evidenceUnchanged}
      entry={entry}
      expanded
      panel={<ExcludedOnlyInspect />}
      sheet="panel"
      viewport={viewport}
      zoom={FITS.welcome}
    >
      <CanvasStage
        entry={entry}
        frames={detailsFrames()}
        view={DETAILS_VIEW}
        zoom={FITS.welcome}
      />
    </CanvasShell>
  );
}

/**
 * The unmodified Action as its variant set, on the branch that changed its
 * own stylesheet, opened from All: its Inspect keeps the examined
 * stylesheet's evidence after the head. On a phone, the whole set shows
 * under the open Inspect sheet.
 */
function ActionExcluded({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <VariantSetArtboard
      catalogue={quietAll(COMPONENT_NAVIGATION.action.id)}
      design={E.evidenceUnchangedAction}
      entry={CANVAS_ENTRIES.action}
      expanded
      frames={actionFrames()}
      panel={<ActionExcludedInspect />}
      sheet="panel"
      viewport={viewport}
      zoom={FITS.action}
    />
  );
}

export const canvasEvidenceUnchangedScreen = defineScreen({
  ...evidenceMetadata,
  description:
    "Details on the branch of Changed styles, which changed generated/excluded.css. Details links only that stylesheet, and none of its changed styles apply to Details, so Details stays out of Changes, offers no comparison, and has Inspect alone. Inspect keeps the evidence after the head: the stylesheet, examined and excluded, then “No changes to this screen.”",
  ...artboardStates(
    {
      state: "details",
      title: "Excluded styles only",
      desktop: <ExcludedOnly viewport="desktop" />,
      mobile: <ExcludedOnly viewport="mobile" />,
    },
    [
      evidenceState(
        "action",
        "Component with excluded styles",
        "The unmodified Action, opened from All on a branch that changed only styles/actions.css, none of whose changed styles apply to the Action, so Changes lists nothing. Inspect keeps that evidence after the head, in the words of a variant, and ends with “No changes to this variant.”",
        (viewport) => <ActionExcluded viewport={viewport} />,
      ),
    ],
  ),
  slug: "unchanged",
  rationale:
    "An entry without Changes has no comparison to show, so its evidence stays in Inspect. A changed stylesheet whose changed styles apply nowhere never adds a Changes row or a comparison, yet the evidence still names it, so a reader can see that it was examined, and the last line confirms that the entry did not change.",
  title: "Evidence in Inspect",
});
