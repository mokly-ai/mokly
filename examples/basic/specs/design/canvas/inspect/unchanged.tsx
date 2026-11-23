import { defineScreen } from "@mokly/mokly";

import { artboards, type ArtboardViewport } from "../../parts/artboards.js";
import { CANVAS_PAGES } from "../parts/destinations.js";
import { CANVAS_ENTRIES } from "../parts/entries.js";
import { ProfileInspect } from "../parts/inspect_entries.js";
import { canvasDesignMetadata } from "../parts/metadata.js";
import { CanvasShell } from "../parts/shell.js";
import { FITS, profileFrames } from "../parts/sketches.js";
import { CanvasStage } from "../parts/stage.js";

/**
 * Profile, which the canonical branch did not modify, so its right panel has
 * the Inspect tab alone. On a phone, the panel sheet is open with that tab.
 */
function Unchanged({ viewport }: { viewport: ArtboardViewport }) {
  const entry = CANVAS_ENTRIES.profile;
  return (
    <CanvasShell
      catalogue={{ filter: "all", activeKey: "profile" }}
      compactZoom={FITS.phone}
      design={CANVAS_PAGES.unchanged}
      entry={entry}
      panel={<ProfileInspect />}
      sheet="panel"
      viewport={viewport}
      zoom={FITS.profile}
    >
      <CanvasStage entry={entry} frames={profileFrames()} zoom={FITS.profile} />
    </CanvasShell>
  );
}

export const canvasUnchangedScreen = defineScreen({
  ...canvasDesignMetadata,
  description:
    "An unmodified screen: the right panel has the Inspect tab alone. Profile renders in Light only, so its stage holds the Light frames and the Dark toggle names that. On a phone, the panel opens as a sheet with its one tab.",
  ...artboards({
    desktop: <Unchanged viewport="desktop" />,
    mobile: <Unchanged viewport="mobile" />,
  }),
  slug: "unchanged",
  title: "Unchanged entry",
});
