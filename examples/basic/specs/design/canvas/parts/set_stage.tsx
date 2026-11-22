import type { ReactNode } from "react";

import type { DepictedView } from "../../parts/depicted_view.js";
import type { ArtboardViewport } from "../../parts/shell.js";

import type { CatalogueView } from "./catalogue.js";
import type { CompareMode } from "./changes_sketches.js";
import type { CanvasDestination } from "./destinations.js";
import type { CanvasEntry } from "./entries.js";
import type { CanvasFrameSpec } from "./frames.js";
import type { CanvasInstance } from "./instances.js";
import type { PanelTab } from "./panel.js";
import {
  SelectionPill,
  frameSelectionOverlays,
  selectionOverlays,
} from "./selection.js";
import { CanvasShell, type CanvasSheet } from "./shell.js";
import { FITS } from "./sketches.js";
import { CanvasStage } from "./stage.js";

/** What the reader selected on a variant set: a frame, or an instance on one. */
type SetSelection = { frame: CanvasFrameSpec } | { instance: CanvasInstance };

/**
 * A component opened as its variant set: its saved variants' frames at the
 * set's fitted zoom, and the Inspect that the caller gives. A selected frame
 * draws its corners and size, and a selected instance draws its selection on
 * its frame; the frame that holds the selection lights its label. The
 * compact form shows the
 * whole set until a selection picks a frame, and then that frame at full
 * size with the frame picker, the pill of a selected instance, and the open
 * sheet that the state asks for. On the Changes tab, the frames keep the
 * compare mode that the state shows.
 */
export function VariantSetArtboard({
  catalogue,
  compare,
  design,
  entry,
  expanded,
  frames,
  panel,
  selection,
  sheet,
  tab,
  view,
  viewport,
  zoom,
}: {
  catalogue: CatalogueView;
  /** The compare mode that the frames show; Current by default. */
  compare?: CompareMode | undefined;
  design: CanvasDestination;
  entry: CanvasEntry;
  /** The open sheet takes its expanded height. */
  expanded?: boolean | undefined;
  frames: readonly CanvasFrameSpec[];
  panel: ReactNode;
  selection?: SetSelection | undefined;
  sheet?: CanvasSheet | undefined;
  /** The right panel's selected tab; Inspect by default. */
  tab?: PanelTab | undefined;
  /** The set's depicted view, where its frames render registered instances. */
  view?: DepictedView | undefined;
  viewport: ArtboardViewport;
  /** The zoom that fits the set, in percent. */
  zoom: number;
}) {
  const frame =
    selection !== undefined && "frame" in selection
      ? selection.frame
      : undefined;
  const instance =
    selection !== undefined && "instance" in selection
      ? selection.instance
      : undefined;
  const picked = frame?.id ?? instance?.frame.id;
  return (
    <CanvasShell
      catalogue={catalogue}
      compactZoom={picked === undefined ? FITS.phoneSet : FITS.phonePicked}
      design={design}
      entry={entry}
      expanded={expanded}
      panel={panel}
      pill={
        instance === undefined ? undefined : (
          <SelectionPill instance={instance} />
        )
      }
      sheet={sheet}
      tab={tab}
      viewport={viewport}
      zoom={zoom}
    >
      <CanvasStage
        compare={compare}
        entry={entry}
        frames={frames}
        overlays={
          frame !== undefined
            ? frameSelectionOverlays(frame)
            : instance !== undefined
              ? selectionOverlays(instance)
              : undefined
        }
        picked={picked}
        selected={picked}
        view={view}
        zoom={zoom}
      />
    </CanvasShell>
  );
}
