import type { ReactNode } from "react";

import type { ArtboardViewport } from "../../../parts/shell.js";
import type { CatalogueView } from "../../parts/catalogue.js";
import type { CanvasDestination } from "../../parts/destinations.js";
import type { CanvasFrameSpec } from "../../parts/frames.js";
import type { PanelTab } from "../../parts/panel.js";
import { CanvasShell } from "../../parts/shell.js";
import { CanvasStage } from "../../parts/stage.js";

import type { RemovedRecord } from "./removed_entries.js";
import {
  PreviousVersionState,
  usePreviousLabel,
  type PreviousStatus,
} from "./removed_stage.js";

/** What every artboard of a removed entry names. */
interface RemovedArtboardProps {
  design: CanvasDestination;
  record: RemovedRecord;
  /** The catalogue in the Changes filter, where the removed entry is listed. */
  catalogue: CatalogueView;
  tab: PanelTab;
  /** The body of the right panel's tab, which stays available. */
  panel: ReactNode;
  /** The panel sheet that a phone shows open; none by default. */
  sheet?: "panel" | undefined;
  viewport: ArtboardViewport;
}

/**
 * A removed entry's previous version on the canvas: the section of its
 * historical frames at one zoom, whose head holds the title tag, the path
 * chip, the Removed status and the quiet label. A page or a document opens
 * as one reading frame. The catalogue and the right panel stay, and the zoom
 * pill and the dock's Fit act on the section.
 */
export function PreviousArtboard({
  catalogue,
  compactZoom,
  design,
  frames,
  lightOnly = false,
  overlays,
  panel,
  record,
  sheet,
  tab,
  viewport,
  zoom,
}: RemovedArtboardProps & {
  frames: readonly CanvasFrameSpec[];
  zoom: number;
  /** The zoom of the compact form's one frame, which the dock's Fit restores. */
  compactZoom: number;
  /** What lies over a frame, such as the note of a view never captured. */
  overlays?: Readonly<Record<string, ReactNode>> | undefined;
  /** A document without a dark render, which keeps its light version. */
  lightOnly?: boolean | undefined;
}) {
  const previous = usePreviousLabel(lightOnly);
  return (
    <CanvasShell
      catalogue={catalogue}
      compactZoom={compactZoom}
      design={design}
      entry={record.entry}
      panel={panel}
      sheet={sheet}
      tab={tab}
      viewport={viewport}
      zoom={zoom}
    >
      <CanvasStage
        entry={record.entry}
        frames={frames}
        overlays={overlays}
        previous={previous}
        zoom={zoom}
      />
    </CanvasShell>
  );
}

/**
 * A removed entry while its previous version loads, or after its request
 * failed: the canvas holds the state in place of the section, so it holds no
 * section to zoom or fit, and neither the zoom pill nor the dock's Fit
 * shows. The catalogue, the compact entry bar and the right panel stay.
 */
export function PendingArtboard({
  catalogue,
  design,
  frames,
  panel,
  record,
  sheet,
  status,
  tab,
  viewport,
}: RemovedArtboardProps & {
  /** The historical frames that a screen's compact frame picker lists. */
  frames: readonly CanvasFrameSpec[];
  status: PreviousStatus;
}) {
  return (
    <CanvasShell
      catalogue={catalogue}
      design={design}
      entry={record.entry}
      panel={panel}
      sheet={sheet}
      tab={tab}
      viewport={viewport}
    >
      <PreviousVersionState
        entry={record.entry}
        frames={frames}
        status={status}
      />
    </CanvasShell>
  );
}
