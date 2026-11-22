import { defineScreen } from "@mokly/mokly";

import { changesDesignMetadata } from "./metadata.js";
import { artboards } from "./parts/artboards.js";
import { REMOVED_SCREENS } from "./parts/nav_data.js";
import { RemovedScreen, RemovedView } from "./parts/removed_screen.js";
import { MiniFarewell } from "./parts/removed_shots.js";
import type { ArtboardViewport } from "./parts/shell.js";

function RemovedPrevious({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <RemovedScreen
      entry={REMOVED_SCREENS.farewell}
      preview={(previewViewport) => (
        <RemovedView
          address="example.test/farewell"
          compact={viewport === "mobile"}
          viewport={previewViewport}
        >
          <MiniFarewell compact={previewViewport === "mobile"} />
        </RemovedView>
      )}
      subject="farewell"
      viewport={viewport}
    />
  );
}

/**
 * A removed screen's previous version. It stays until decision 34 settles
 * how the Canvas family shows a removed entry's previous version.
 */
export const removedScreen = defineScreen({
  ...changesDesignMetadata,
  colorSchemes: ["light"],
  description:
    "A removed screen shown as the previous version of its mobile and desktop views.",
  ...artboards({
    desktop: <RemovedPrevious viewport="desktop" />,
    mobile: <RemovedPrevious viewport="mobile" />,
  }),
  slug: "removed",
  rationale:
    "A removed screen has nothing current to compare, so the stage carries its previous views under a quiet label instead of a comparison band. The catalogue-wide Appearance selector remains the only theme control, while the historical frame stays Light because that is the only scheme captured for those views.",
  title: "Removed screen",
});
