import { defineScreen } from "@mokly/mokly";

import { artboardStates } from "../../parts/artboards.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { COMPARISON_VIEW } from "../parts/changes_sketches.js";
import { CANVAS_PAGES } from "../parts/destinations.js";
import { canvasChangesMetadata } from "../parts/metadata.js";
import { CanvasShell } from "../parts/shell.js";
import { FITS } from "../parts/sketches.js";
import { CanvasStage } from "../parts/stage.js";

import { OUTCOME_PAGES } from "./parts/destinations.js";
import {
  INVOICE,
  INVOICE_FIT,
  invoiceFrames,
  invoiceOverlayFrames,
} from "./parts/invoice.js";
import { InvoiceChanges } from "./parts/invoice_changes.js";
import { InvoiceInspect } from "./parts/invoice_inspect.js";

/** The tab that a state of the moved entry shows. */
type MovedState = "changes" | "inspect";

/**
 * Invoice, which the canonical branch moved under Account with edits, on
 * its Light frames, with the catalogue in the Changes filter and
 * `Invoice · Moved` selected. On the Changes tab, Overlay compares every
 * frame with the version at its previous path, and the rows of Welcome and
 * Details keep the tab. Inspect keeps the filter. On a phone, the Changes
 * tab shows the one frame with the overlay, and Inspect opens the panel
 * sheet.
 */
function Moved({
  state,
  viewport,
}: {
  state: MovedState;
  viewport: ArtboardViewport;
}) {
  const changes = state === "changes";
  return (
    <CanvasShell
      catalogue={{
        filter: "changes",
        activeKey: "invoice",
        targets: changes
          ? {
              welcome: CANVAS_PAGES.changesCurrent,
              details: CANVAS_PAGES.addedChanges,
            }
          : undefined,
      }}
      compactZoom={FITS.phone}
      design={changes ? OUTCOME_PAGES.moved : OUTCOME_PAGES.movedInspect}
      entry={INVOICE}
      panel={changes ? <InvoiceChanges /> : <InvoiceInspect />}
      sheet={changes ? undefined : "panel"}
      tab={state}
      viewport={viewport}
      zoom={INVOICE_FIT}
    >
      <CanvasStage
        compare={changes ? "overlay" : undefined}
        entry={INVOICE}
        frames={changes ? invoiceOverlayFrames() : invoiceFrames()}
        view={changes ? COMPARISON_VIEW : undefined}
        zoom={INVOICE_FIT}
      />
    </CanvasShell>
  );
}

export const canvasMovedScreen = defineScreen({
  ...canvasChangesMetadata,
  relatedDocs: [
    ...canvasChangesMetadata.relatedDocs,
    "docs/protocol/mokly-moves.md",
  ],
  description:
    "Invoice, which the branch moved under Account with edits: its Changes row reads Moved, and Overlay compares its Light frames with the version at its previous path. On a phone, the one frame shows the overlay.",
  ...artboardStates(
    {
      state: "changes",
      title: "Changes",
      desktop: <Moved state="changes" viewport="desktop" />,
      mobile: <Moved state="changes" viewport="mobile" />,
    },
    [
      {
        colorSchemes: canvasChangesMetadata.colorSchemes,
        description:
          "Inspect of the moved Invoice: its Details add the Moved from row with its previous path, and its related Payment terms opens the document. On a phone, the panel sheet is open.",
        desktop: <Moved state="inspect" viewport="desktop" />,
        mobile: <Moved state="inspect" viewport="mobile" />,
        slug: "inspect",
        title: "Inspect",
      },
    ],
  ),
  slug: "moved",
  rationale:
    "Moving a folder should not read as deleting one screen and adding another. Each moved entry keeps one Changes row at its new place, its variant and the document beside it move with it, and the comparison still starts from the version at its previous path.",
  title: "Moved entry",
});
