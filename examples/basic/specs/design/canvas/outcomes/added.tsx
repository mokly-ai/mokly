import { defineScreen } from "@mokly/mokly";

import { artboardStates } from "../../parts/artboards.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { DetailsChanges } from "../parts/changes.js";
import { DETAILS_VIEW, detailsFrames } from "../parts/changes_sketches.js";
import { CANVAS_PAGES } from "../parts/destinations.js";
import { CANVAS_ENTRIES } from "../parts/entries.js";
import { DetailsInspect } from "../parts/inspect_details.js";
import { canvasChangesMetadata } from "../parts/metadata.js";
import { CanvasShell } from "../parts/shell.js";
import { FITS } from "../parts/sketches.js";
import { CanvasStage } from "../parts/stage.js";

/** The tab that a state of the added entry shows. */
type AddedState = "changes" | "inspect";

/**
 * Details, which the canonical branch added, as four frames: on the Inspect
 * tab with the catalogue in All, or on the Changes tab with the catalogue in
 * the Changes filter, whose rows keep the tab. On a phone, the compact
 * layout, with the Changes sheet open on the Changes tab.
 */
function Added({
  state,
  viewport,
}: {
  state: AddedState;
  viewport: ArtboardViewport;
}) {
  const entry = CANVAS_ENTRIES.details;
  const changes = state === "changes";
  const design = changes ? CANVAS_PAGES.addedChanges : CANVAS_PAGES.added;
  return (
    <CanvasShell
      catalogue={
        changes
          ? {
              filter: "changes",
              activeKey: "details",
              targets: {
                welcome: CANVAS_PAGES.changesCurrent,
                details: design,
              },
            }
          : { filter: "all", activeKey: "details" }
      }
      compactZoom={FITS.phone}
      design={design}
      entry={entry}
      panel={changes ? <DetailsChanges /> : <DetailsInspect />}
      sheet={changes ? "panel" : undefined}
      tab={changes ? "changes" : "inspect"}
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

export const canvasAddedScreen = defineScreen({
  ...canvasChangesMetadata,
  description:
    "Details, which the branch added: its section names it Added, and the right panel has both tabs. On a phone, the compact layout with the dock.",
  ...artboardStates(
    {
      state: "inspect",
      title: "Inspect",
      desktop: <Added state="inspect" viewport="desktop" />,
      mobile: <Added state="inspect" viewport="mobile" />,
    },
    [
      {
        colorSchemes: canvasChangesMetadata.colorSchemes,
        description:
          "The Changes tab of an added entry: its place among the branch's changes, the current version alone, and Current, the one mode it offers. On a phone, the Changes sheet is open.",
        desktop: <Added state="changes" viewport="desktop" />,
        mobile: <Added state="changes" viewport="mobile" />,
        slug: "changes",
        title: "Changes",
      },
    ],
  ),
  slug: "added",
  rationale:
    "An added entry has no version before, so Changes offers it only in Current and says why, while the stepper still steps through the branch's changes.",
  title: "Added entry",
});
