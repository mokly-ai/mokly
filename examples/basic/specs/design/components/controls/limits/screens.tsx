import { defineScreen } from "@mokly/mokly";

import { controlsDesignMetadata } from "../../../metadata.js";
import { artboards } from "../../../parts/artboards.js";
import type { ArtboardViewport } from "../../../parts/shell.js";
import { ComponentPage } from "../../parts/component_page.js";
import { LIMIT_PAGES } from "../../parts/destinations.js";
import { ScreenPage } from "../../parts/screen_page.js";
import { NoPropsPanel, ReadOnlyPanel, RemovedPanel } from "../parts/limits.js";
import { ControlsPage } from "../parts/page.js";

function Removed({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <ComponentPage
      state="removed"
      viewport={viewport}
      limit={{ design: LIMIT_PAGES.removed, panel: <RemovedPanel /> }}
    />
  );
}

function ReadOnly({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <ComponentPage
      state="unused"
      viewport={viewport}
      limit={{
        design: LIMIT_PAGES["read-only"],
        panel: (
          <ReadOnlyPanel
            title="Badge"
            values={[{ name: "label", value: '"New"' }]}
          />
        ),
      }}
    />
  );
}

function NoProps({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <ScreenPage
      state="empty"
      viewport={viewport}
      limit={{ design: LIMIT_PAGES["no-props"], panel: <NoPropsPanel /> }}
    />
  );
}

/** Props-tab states without editing, and recovery states that keep the edits. */
export const removedScreen = defineScreen({
  ...controlsDesignMetadata,
  slug: "removed",
  title: "Removed entry",
  description:
    "A removed saved variant keeps its saved props readable in the Props tab; there is nothing to edit.",
  colorSchemes: ["light"],
  ...artboards({
    desktop: <Removed viewport="desktop" />,
    mobile: <Removed viewport="mobile" />,
  }),
});
export const readOnlyScreen = defineScreen({
  ...controlsDesignMetadata,
  slug: "read-only",
  title: "Read-only props",
  description:
    "A component that declares no controls shows its saved props without fields.",
  colorSchemes: ["light"],
  ...artboards({
    desktop: <ReadOnly viewport="desktop" />,
    mobile: <ReadOnly viewport="mobile" />,
  }),
});
export const noPropsScreen = defineScreen({
  ...controlsDesignMetadata,
  slug: "no-props",
  title: "Entry without props",
  description:
    "A screen without props or registered components says so in the Props tab instead of asking for a selection.",
  colorSchemes: ["light"],
  ...artboards({
    desktop: <NoProps viewport="desktop" />,
    mobile: <NoProps viewport="mobile" />,
  }),
});
export const invalidTogetherScreen = defineScreen({
  ...controlsDesignMetadata,
  slug: "invalid-together",
  title: "Values not valid together",
  description:
    "Edited props that fail as a whole highlight no field; Reset to Default is the one way back.",
  colorSchemes: ["light"],
  ...artboards({
    desktop: <ControlsPage state="invalid-together" viewport="desktop" />,
    mobile: <ControlsPage state="invalid-together" viewport="mobile" />,
  }),
});
export const expiredScreen = defineScreen({
  ...controlsDesignMetadata,
  slug: "expired",
  title: "Preview expired",
  description:
    "Serve discarded the temporary preview of the edits: the preview shows the saved props, the edits stay, and Update preview renders them again.",
  colorSchemes: ["light"],
  ...artboards({
    desktop: <ControlsPage state="expired" viewport="desktop" />,
    mobile: <ControlsPage state="expired" viewport="mobile" />,
  }),
});
