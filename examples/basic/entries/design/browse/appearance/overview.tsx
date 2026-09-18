import { screen } from "@mokly/mokly";

import { DESTINATIONS } from "../../parts/destinations.js";
import { ExampleWorkspace } from "../../parts/example_workspace.js";
import type { ArtboardViewport } from "../../parts/shell.js";

import { AppearanceHead, AppearanceShell } from "./parts/scaffold.js";

/** The canonical appearance state: a dark interface holding a light preview. */
function AppearanceOverview({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <AppearanceShell
      activeLabel="Welcome"
      appearance="dark"
      appearanceChoice="dark"
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
  colorSchemes: ["light"],
  description:
    "The catalogue drawn in the dark interface while the screen it shows stays light.",
  desktop: <AppearanceOverview viewport="desktop" />,
  id: "design-appearance-overview",
  mobile: <AppearanceOverview viewport="mobile" />,
  rationale:
    "Appearance and preview colour scheme are separate settings, so the canonical state proves a dark catalogue can hold a light screen: the navigation, header, stage and inspector follow the interface palette while the phone and browser previews keep their own light surfaces, status indicators and ink.",
  slug: "overview",
  title: "Dark interface",
});
