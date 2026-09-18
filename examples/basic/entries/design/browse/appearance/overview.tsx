import { screen } from "@mokly/mokly";

import { DESTINATIONS } from "../../parts/destinations.js";
import { ExampleWorkspace } from "../../parts/example_workspace.js";
import type { ArtboardViewport } from "../../parts/shell.js";

import { AppearanceHead, AppearanceShell } from "./parts/scaffold.js";

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
      <ExampleWorkspace subject="welcome" viewport={viewport} />
    </AppearanceShell>
  );
}

export const appearanceOverviewScreen = screen({
  description:
    "The catalogue around a selected screen, drawn in Light and in Dark.",
  desktop: <AppearanceOverview viewport="desktop" />,
  id: "design-appearance-overview",
  mobile: <AppearanceOverview viewport="mobile" />,
  rationale:
    "Appearance and preview colour scheme are separate settings, so the canonical state proves the catalogue can change appearance while the screen it shows keeps its own light surfaces, status indicators and ink. Use the preview control above to move between the two renderings.",
  slug: "overview",
  title: "Catalogue appearance",
});
