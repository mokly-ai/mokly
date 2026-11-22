import type { ReactNode } from "react";

import { COMPONENT_NAVIGATION } from "../../../parts/component_nav_data.js";
import type { ArtboardViewport } from "../../../parts/shell.js";
import type { PendingDetails } from "../../loading/parts/details.js";
import { DetailsStage } from "../../loading/parts/stage_state.js";
import type { CanvasDestination } from "../../parts/destinations.js";
import { CANVAS_ENTRIES } from "../../parts/entries.js";
import type { CanvasFrameSpec } from "../../parts/frames.js";
import { frameSelectionOverlays } from "../../parts/selection.js";
import { CanvasShell } from "../../parts/shell.js";
import { FITS } from "../../parts/sketches.js";
import { CanvasStage } from "../../parts/stage.js";

/**
 * The Action opened as its variant set with one saved variant chosen, as
 * Inspect's Props edits it: the chosen variant's Light frame is selected,
 * with its corners and its size, at the set's fitted zoom, and what lies
 * over the edited variant's frames, such as the status of a render in
 * flight, joins the selection. Until the route's details arrive, the stage
 * holds their shipped state in place of the frames, and the compact frame
 * picker still picks the chosen frame. On a phone, the frame picker shows
 * the selected frame alone at full size, under the open Inspect sheet.
 */
export function ChosenVariantArtboard({
  design,
  details,
  frame,
  frames,
  overlays = {},
  panel,
  viewport,
}: {
  design: CanvasDestination;
  /** The route's details while they load or failed; they arrived by default. */
  details?: PendingDetails | undefined;
  /** The chosen variant's Light frame, which the reader selected. */
  frame: CanvasFrameSpec;
  frames: readonly CanvasFrameSpec[];
  /** What lies over a frame besides the selection, by the frame's id. */
  overlays?: Readonly<Record<string, ReactNode>> | undefined;
  /** Inspect, open at the Props section. */
  panel: ReactNode;
  viewport: ArtboardViewport;
}) {
  const selection = frameSelectionOverlays(frame);
  const entry = CANVAS_ENTRIES.action;
  return (
    <CanvasShell
      catalogue={{ filter: "all", activeKey: COMPONENT_NAVIGATION.action.id }}
      compactZoom={FITS.phonePicked}
      design={design}
      entry={entry}
      panel={panel}
      sheet="panel"
      viewport={viewport}
      zoom={FITS.action}
    >
      {details === undefined ? (
        <CanvasStage
          entry={entry}
          frames={frames}
          overlays={{
            ...overlays,
            [frame.id]: (
              <>
                {selection[frame.id]}
                {overlays[frame.id]}
              </>
            ),
          }}
          picked={frame.id}
          selected={frame.id}
          zoom={FITS.action}
        />
      ) : (
        <DetailsStage
          details={details}
          entry={entry}
          frames={frames}
          picked={frame.id}
        />
      )}
    </CanvasShell>
  );
}
