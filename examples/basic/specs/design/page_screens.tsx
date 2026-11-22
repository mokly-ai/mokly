import { defineScreen } from "@mokly/mokly";

import { ExampleDocument } from "../document.js";

import { designMetadata } from "./metadata.js";
import { artboards } from "./parts/artboards.js";
import { REMOVED_DOCUMENTS, RemovedPageScreen } from "./parts/removed_page.js";
import type { ArtboardViewport } from "./parts/shell.js";

/** The previous version of the removed handbook, rendered read-only. */
function RemovedPageView({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <RemovedPageScreen
      document={<ExampleDocument readOnly />}
      entry={REMOVED_DOCUMENTS.handbook}
      viewport={viewport}
    />
  );
}

/**
 * A removed document's previous version. It stays until decision 34 settles
 * how the Canvas family shows a removed entry's previous version.
 */
export const removedScreen = defineScreen({
  ...designMetadata,
  slug: "removed",
  title: "Removed document",
  description:
    "A removed document opens its previous version, keeping its flat Changes row and baseline ancestry.",
  rationale:
    "Deleting a document should not hide what it said. The previous version is the only readable copy left, so the stage shows it read-only under a quiet label instead of an empty state, while the Removed badge and the ancestry of the deleted parent stay in place.",
  colorSchemes: ["light"],
  ...artboards({
    desktop: <RemovedPageView viewport="desktop" />,
    mobile: <RemovedPageView viewport="mobile" />,
  }),
});
