import { screen } from "@mokly/mokly";

import { DESTINATIONS } from "../../parts/destinations.js";
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
        idChip="example-welcome"
        title="Welcome"
        viewport={viewport}
      />
      <AppearanceWorkspace subject="welcome" viewport={viewport} />
    </AppearanceShell>
  );
}

export const appearanceOverviewScreen = screen({
  description: "The catalogue and the screen it shows, all light or all dark.",
  desktop: <AppearanceOverview viewport="desktop" />,
  id: "design-appearance-overview",
  mobile: <AppearanceOverview viewport="mobile" />,
  rationale:
    "Standalone Browse holds one Appearance setting, so the chrome and the screens it shows change together rather than needing two controls. The artboard draws that one selector in its top bar; use the preview control above to move between the two renderings.",
  slug: "overview",
  title: "Catalogue appearance",
});
