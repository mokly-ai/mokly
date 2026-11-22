import { defineScreen } from "@mokly/mokly";

import { artboards } from "../../parts/artboards.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { EmptyState } from "../../parts/stage_content.js";
import { CANVAS_PAGES as C } from "../parts/destinations.js";
import { canvasDesignMetadata } from "../parts/metadata.js";
import { CanvasShell } from "../parts/shell.js";

import { StageState } from "./parts/stage_state.js";

/**
 * A route that matches no entry: nothing is selected, so the canvas holds
 * the message and no right panel shows, and the catalogue stays in All. On
 * a phone, the dock holds Catalogue alone.
 */
function Missing({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <CanvasShell
      catalogue={{ filter: "all" }}
      design={C.loadingMissing}
      viewport={viewport}
    >
      <StageState state="missing">
        <EmptyState
          body="Nothing in the catalogue matches"
          code="view/unknown/"
          linkLabel="Go to the catalogue home"
          title="Item not found"
          to={C.home}
        />
      </StageState>
    </CanvasShell>
  );
}

export const canvasMissingScreen = defineScreen({
  ...canvasDesignMetadata,
  description:
    "A route that matches no entry: the canvas names the requested path and offers the catalogue home, and the catalogue stays beside it to choose another item. Nothing is selected, so no right panel shows. On a phone, the dock opens the catalogue.",
  ...artboards({
    desktop: <Missing viewport="desktop" />,
    mobile: <Missing viewport="mobile" />,
  }),
  slug: "missing",
  rationale:
    "The message covers the whole catalogue, so it names no kind of entry, and both ways forward stay in view: another item from the catalogue, or the catalogue home.",
  title: "Item not found",
});
