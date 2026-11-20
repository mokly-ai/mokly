import { defineScreen } from "@mokly/mokly";

import { artboardStates, type ArtboardVariant } from "../../parts/artboards.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { CANVAS_ENTRIES } from "../parts/entries.js";
import { WelcomeInspect } from "../parts/inspect_welcome.js";
import { canvasDesignMetadata } from "../parts/metadata.js";
import { SelectionPill, selectionOverlays } from "../parts/selection.js";
import { CanvasShell } from "../parts/shell.js";
import { FITS, WELCOME_VIEW, welcomeFrames } from "../parts/sketches.js";
import { CanvasStage } from "../parts/stage.js";
import {
  WELCOME_INSTANCES,
  type WelcomeInstanceId,
} from "../parts/welcome_instances.js";

/**
 * Welcome with one of its instances selected on Mobile · Light: the canvas
 * zoomed onto that frame draws the selection, and Inspect opens at the
 * Selection section. On a phone, the one frame draws the selection, and the
 * pill above the dock names it.
 */
function Selection({
  instance: id,
  viewport,
}: {
  instance: WelcomeInstanceId;
  viewport: ArtboardViewport;
}) {
  const entry = CANVAS_ENTRIES.welcome;
  const instance = WELCOME_INSTANCES[id];
  return (
    <CanvasShell
      catalogue={{ filter: "all", activeKey: "welcome" }}
      compactZoom={FITS.phone}
      design={instance.page}
      entry={entry}
      panel={
        <WelcomeInspect
          design={instance.page}
          initial="selection"
          selected={id}
        />
      }
      pill={<SelectionPill instance={instance} />}
      viewport={viewport}
      zoom={100}
    >
      <CanvasStage
        entry={entry}
        frames={welcomeFrames()}
        overlays={selectionOverlays(instance)}
        pan="end"
        view={WELCOME_VIEW}
        zoom={100}
      />
    </CanvasShell>
  );
}

/** A saved state that selects another of Welcome's instances. */
function selected(
  id: WelcomeInstanceId,
  title: string,
  description: string,
): ArtboardVariant {
  return {
    colorSchemes: canvasDesignMetadata.colorSchemes,
    description,
    desktop: <Selection instance={id} viewport="desktop" />,
    mobile: <Selection instance={id} viewport="mobile" />,
    slug: id,
    title,
  };
}

export const canvasSelectionScreen = defineScreen({
  ...canvasDesignMetadata,
  description:
    "Welcome's View details Action selected on Mobile · Light: the outline with its handles, the name and size tags, and the padding redline, while Inspect shows the instance's props, size, box model, and source. On a phone, the pill above the dock names the selection and opens the Inspect sheet.",
  ...artboardStates(
    {
      state: "details",
      title: "Action · details",
      desktop: <Selection instance="details" viewport="desktop" />,
      mobile: <Selection instance="details" viewport="mobile" />,
    },
    [
      selected(
        "toolbar",
        "Toolbar · toolbar",
        "Welcome's Toolbar selected, with its padding on all four sides.",
      ),
      selected(
        "primary",
        "Action · primary",
        "The Toolbar's first Action selected, an instance nested in the Toolbar.",
      ),
      selected(
        "secondary",
        "Action · secondary",
        "The Toolbar's second Action selected, an instance nested in the Toolbar.",
      ),
    ],
  ),
  slug: "selection",
  rationale:
    "A click on an element of a frame selects its component instance, so a reader sees which component drew it, the props it received, and its spacing, without leaving the canvas. The component tree selects the same instances.",
  title: "Selection",
});
