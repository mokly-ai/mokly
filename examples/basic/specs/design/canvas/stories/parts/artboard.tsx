import type { ArtboardViewport } from "../../../parts/artboards.js";
import type { CatalogueView } from "../../parts/catalogue.js";
import type { CanvasFrameSpec } from "../../parts/frames.js";
import { VariantSetArtboard } from "../../parts/set_stage.js";

import type { MenuStory } from "./branch.js";
import type { StoryDestination } from "./destinations.js";
import { MenuInspect } from "./inspect.js";
import { MENU_FITS } from "./sketches.js";

/**
 * A story of the Menu on Inspect: the Menu's variant set, with the story's
 * frame selected where the state selects one, and Inspect at its head. The
 * Story and Storybook rows of Details are the point of every story state,
 * so a phone opens the Inspect sheet over the stage, where they show.
 */
export function StoryInspectArtboard({
  catalogue,
  design,
  frame,
  frames,
  story,
  viewport,
}: {
  catalogue: CatalogueView;
  design: StoryDestination;
  /** The selected frame; none on the Menu's own page. */
  frame?: CanvasFrameSpec | undefined;
  frames: readonly CanvasFrameSpec[];
  story: MenuStory;
  viewport: ArtboardViewport;
}) {
  return (
    <VariantSetArtboard
      catalogue={catalogue}
      design={design}
      entry={story.entry}
      fit={MENU_FITS.set}
      frames={frames}
      panel={<MenuInspect frame={frame} story={story} />}
      selection={frame === undefined ? undefined : { frame }}
      sheet="panel"
      viewport={viewport}
    />
  );
}
