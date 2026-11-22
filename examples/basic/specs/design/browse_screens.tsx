import { defineScreen } from "@mokly/mokly";

import { designMetadata } from "./metadata.js";
import { artboards } from "./parts/artboards.js";
import { DESTINATIONS } from "./parts/destinations.js";
import { ExampleWorkspace } from "./parts/example_workspace.js";
import { NavTree } from "./parts/nav.js";
import { WelcomeHead } from "./parts/screen_heads.js";
import { Shell, type ArtboardViewport } from "./parts/shell.js";

/** Welcome with an empty query and the search field's tag picker open. */
function TagPicker({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <Shell
      design={DESTINATIONS.tagPicker}
      viewport={viewport}
      nav={<NavTree activeLabel="Welcome" />}
      tagPickerOpen
    >
      <ExampleWorkspace
        header={<WelcomeHead active={viewport} />}
        subject="welcome"
        viewport={viewport}
        open={viewport === "desktop"}
      />
    </Shell>
  );
}

/**
 * Welcome with the tag picker open, the subject of the library runtime test
 * in `tests/browser/design_library_runtime_cases.ts`. It stays until a fix of
 * the viewer race that opens Props on a nested disclosure lets that test move
 * to `design/canvas/search/tags`. The screen whose variant it was is gone, so
 * it declares the path that it had as that variant.
 */
export const tagPickerScreen = defineScreen({
  ...designMetadata,
  colorSchemes: ["light"],
  description: "Welcome with an empty query and the tag picker open.",
  ...artboards({
    desktop: <TagPicker viewport="desktop" />,
    mobile: <TagPicker viewport="mobile" />,
  }),
  path: "design/browse/views/screen/tag-picker",
  title: "Tag picker",
});
