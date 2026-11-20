import { defineScreen } from "@mokly/mokly";

import { artboards } from "../../parts/artboards.js";
import { COMPONENT_NAVIGATION } from "../../parts/component_nav_data.js";
import type { ArtboardViewport } from "../../parts/shell.js";
import { CANVAS_PAGES } from "../parts/destinations.js";
import { CANVAS_ENTRIES } from "../parts/entries.js";
import { ActionInspect } from "../parts/inspect_entries.js";
import { canvasDesignMetadata } from "../parts/metadata.js";
import { CanvasShell } from "../parts/shell.js";
import { FITS, actionFrames } from "../parts/sketches.js";
import { CanvasStage } from "../parts/stage.js";

/**
 * The Action component opened as its variant set: Default, Disabled, and
 * Secondary, each in Light and Dark, with Inspect for a component.
 */
function ComponentSet({ viewport }: { viewport: ArtboardViewport }) {
  const entry = CANVAS_ENTRIES.action;
  return (
    <CanvasShell
      catalogue={{ filter: "all", activeKey: COMPONENT_NAVIGATION.action.id }}
      compactZoom={FITS.phoneSet}
      design={CANVAS_PAGES.componentSet}
      entry={entry}
      panel={<ActionInspect />}
      viewport={viewport}
      zoom={FITS.action}
    >
      <CanvasStage entry={entry} frames={actionFrames()} zoom={FITS.action} />
    </CanvasShell>
  );
}

export const canvasComponentSetScreen = defineScreen({
  ...canvasDesignMetadata,
  description:
    "A component opens as its variant set: one row per saved variant, Light beside Dark, inside a dashed outline. Inspect names the component, its variants, and its frames.",
  ...artboards({
    desktop: <ComponentSet viewport="desktop" />,
    mobile: <ComponentSet viewport="mobile" />,
  }),
  slug: "component-set",
  title: "Component set",
});
