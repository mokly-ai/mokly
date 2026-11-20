import { defineScreen } from "@mokly/mokly";

import { artboardStates, type ArtboardVariant } from "../../parts/artboards.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { DetailsChanges } from "../parts/changes.js";
import { DETAILS_VIEW, detailsFrames } from "../parts/changes_sketches.js";
import { CANVAS_PAGES } from "../parts/destinations.js";
import { CANVAS_ENTRIES } from "../parts/entries.js";
import { DetailsInspect } from "../parts/inspect_details.js";
import {
  DETAILS_INSTANCES,
  type DetailsInstanceId,
} from "../parts/instance_records.js";
import { canvasChangesMetadata } from "../parts/metadata.js";
import { ScreenSelection } from "../parts/selection_stage.js";
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

/**
 * Details with one of its instances selected on Mobile · Light, as its
 * component tree selects it: the canvas zoomed onto that frame draws the
 * selection, and Inspect opens at the Selection section. The catalogue's
 * selected row opens this artboard.
 */
function Selected({
  instance: id,
  viewport,
}: {
  instance: DetailsInstanceId;
  viewport: ArtboardViewport;
}) {
  const instance = DETAILS_INSTANCES[id];
  return (
    <ScreenSelection
      catalogue={{
        filter: "all",
        activeKey: "details",
        targets: { details: instance.page },
      }}
      entry={CANVAS_ENTRIES.details}
      frames={detailsFrames()}
      instance={instance}
      panel={
        <DetailsInspect
          design={instance.page}
          initial="selection"
          selected={id}
        />
      }
      view={DETAILS_VIEW}
      viewport={viewport}
    />
  );
}

/** A saved state that selects one of Details' instances. */
function selected(
  id: DetailsInstanceId,
  title: string,
  description: string,
): ArtboardVariant {
  return {
    colorSchemes: canvasChangesMetadata.colorSchemes,
    description,
    desktop: <Selected instance={id} viewport="desktop" />,
    mobile: <Selected instance={id} viewport="mobile" />,
    slug: id,
    title,
  };
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
      selected(
        "welcome",
        "Action · welcome",
        "Details' own Action, which returns to Welcome, selected from its component tree.",
      ),
      selected(
        "toolbar",
        "Toolbar · toolbar",
        "Details' Toolbar selected, with its padding on all four sides.",
      ),
      selected(
        "primary",
        "Action · primary",
        "The Toolbar's first Action selected, an instance nested in Details' Toolbar.",
      ),
      selected(
        "secondary",
        "Action · secondary",
        "The Toolbar's second Action selected, an instance nested in Details' Toolbar.",
      ),
    ],
  ),
  slug: "added",
  rationale:
    "An added entry has no version before, so Changes offers it only in Current and says why, while the stepper still steps through the branch's changes.",
  title: "Added entry",
});
