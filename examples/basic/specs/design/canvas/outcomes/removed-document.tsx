import { defineScreen } from "@mokly/mokly";

import { artboardStates } from "../../parts/artboards.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import type { CanvasDestination } from "../parts/destinations.js";
import type { CanvasFrameSpec } from "../parts/frames.js";
import { FITS } from "../parts/sketches.js";

import { OUTCOME_PAGES as O } from "./parts/destinations.js";
import { removedMetadata, removedState } from "./parts/metadata.js";
import { PendingArtboard, PreviousArtboard } from "./parts/removed_artboard.js";
import {
  LIGHT_ONLY_CHANGES,
  handbookRemoved,
  handbookStep,
} from "./parts/removed_branches.js";
import {
  LIGHT_ONLY_RECORD,
  REMOVED_PAGE_RECORDS as P,
  type RemovedRecord,
} from "./parts/removed_entries.js";
import {
  RemovedChanges,
  RemovedDocumentInspect,
} from "./parts/removed_panel.js";
import {
  fieldGuideFrames,
  handbookFrames,
  lightOnlyFrames,
} from "./parts/removed_sketches.js";

/**
 * A page that the handbook branch removed, selected from the Changes filter
 * on the Changes tab: its previous version as one reading frame, which keeps
 * the page's light document in both appearances. On a phone, the frame takes
 * the canvas width.
 */
function Page({
  design,
  frames,
  record,
  viewport,
}: {
  design: CanvasDestination;
  frames: readonly CanvasFrameSpec[];
  record: RemovedRecord;
  viewport: ArtboardViewport;
}) {
  return (
    <PreviousArtboard
      catalogue={handbookRemoved(record)}
      compactZoom={FITS.document}
      design={design}
      frames={frames}
      panel={<RemovedChanges step={handbookStep(record)} />}
      record={record}
      tab="changes"
      viewport={viewport}
      zoom={FITS.document}
    />
  );
}

/**
 * Printing tips while its previous version loads, and Style notes after its
 * request failed. No artboard shows Style notes loading again, so its Retry
 * is a picture. A reading frame has no frame picker.
 */
function PendingPage({
  failed,
  viewport,
}: {
  failed: boolean;
  viewport: ArtboardViewport;
}) {
  const record = failed ? P.styleNotes : P.printingTips;
  return (
    <PendingArtboard
      catalogue={handbookRemoved(record)}
      design={failed ? O.removedDocumentUnavailable : O.removedDocumentLoading}
      frames={handbookFrames()}
      panel={<RemovedChanges step={handbookStep(record)} />}
      record={record}
      status={failed ? "failed" : "loading"}
      tab="changes"
      viewport={viewport}
    />
  );
}

/**
 * The Payment terms document, which a branch of its own removed after the
 * catalogue enabled Dark, on Inspect, which holds its head alone. Its
 * previous version has a light render only, so its reading frame keeps the
 * light version under Dark, and the head's label then says so.
 */
function LightOnly({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <PreviousArtboard
      catalogue={LIGHT_ONLY_CHANGES}
      compactZoom={FITS.document}
      design={O.removedDocumentLightOnly}
      frames={lightOnlyFrames()}
      lightOnly
      panel={<RemovedDocumentInspect record={LIGHT_ONLY_RECORD} />}
      record={LIGHT_ONLY_RECORD}
      tab="inspect"
      viewport={viewport}
      zoom={FITS.document}
    />
  );
}

export const canvasRemovedDocumentScreen = defineScreen({
  ...removedMetadata,
  description:
    "Getting started, a page of the Handbook folder that a branch removed with the folder, opens its previous version as one reading frame, with the Removed status and Showing previous version in the section head. Its Changes tab offers no compare mode.",
  ...artboardStates(
    {
      state: "changes",
      title: "Changes",
      desktop: (
        <Page
          design={O.removedDocument}
          frames={handbookFrames()}
          record={P.gettingStarted}
          viewport="desktop"
        />
      ),
      mobile: (
        <Page
          design={O.removedDocument}
          frames={handbookFrames()}
          record={P.gettingStarted}
          viewport="mobile"
        />
      ),
    },
    [
      removedState(
        "long",
        "Long page",
        "The Field guide, a page longer than its reading frame, scrolls inside the frame and keeps its section headings.",
        (viewport) => (
          <Page
            design={O.removedDocumentLong}
            frames={fieldGuideFrames(viewport)}
            record={P.fieldGuide}
            viewport={viewport}
          />
        ),
      ),
      removedState(
        "loading",
        "Loading",
        "Printing tips while its previous version loads: the canvas holds the status line in place of the section, so neither the zoom pill nor the dock's Fit shows.",
        (viewport) => <PendingPage failed={false} viewport={viewport} />,
      ),
      removedState(
        "unavailable",
        "Unavailable",
        "Style notes after its previous version could not be loaded: the canvas says so, and Retry repeats the request.",
        (viewport) => <PendingPage failed viewport={viewport} />,
      ),
      removedState(
        "light-only",
        "Light only",
        "Payment terms, removed after the catalogue enabled Dark, has a light previous render only. Under Dark, its reading frame keeps the light version, and the section head reads Showing previous version — Light only.",
        (viewport) => <LightOnly viewport={viewport} />,
      ),
    ],
  ),
  slug: "removed-document",
  rationale:
    "Deleting a page or a document should not hide what it said. Its previous version is the one readable copy left, so it opens as one reading frame, read-only, under the label that names it.",
  title: "Removed document",
});
