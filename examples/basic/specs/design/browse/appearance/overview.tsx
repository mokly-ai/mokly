import { defineScreen } from "@mokly/mokly";

import { appearanceDesignMetadata } from "../../metadata.js";
import { DESTINATIONS } from "../../parts/destinations.js";
import { ENTRY_PATHS } from "../../parts/entry_paths.js";
import type { ArtboardViewport } from "../../parts/shell.js";

import {
  AppearanceHead,
  AppearanceShell,
  AppearanceWorkspace,
} from "./parts/scaffold.js";

/** The canonical appearance state: a selected screen in either appearance. */
function AppearanceOverview({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <AppearanceShell
      activeLabel="Welcome"
      design={DESTINATIONS.appearance}
      viewport={viewport}
    >
      <AppearanceHead
        path={ENTRY_PATHS.welcome}
        title="Welcome"
        viewport={viewport}
      />
      <AppearanceWorkspace subject="welcome" viewport={viewport} />
    </AppearanceShell>
  );
}

export const appearanceOverviewScreen = defineScreen({
  ...appearanceDesignMetadata,
  description: "The catalogue and the screen it shows, all light or all dark.",
  desktop: <AppearanceOverview viewport="desktop" />,
  slug: "overview",
  mobile: <AppearanceOverview viewport="mobile" />,
  rationale:
    "Standalone Browse holds one Appearance setting, so the chrome and the screens it shows change together rather than needing two controls. The artboard draws that one selector in its top bar; use the preview control above to move between the two renderings.",
  title: "Catalogue appearance",
});
