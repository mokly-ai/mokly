import { screen } from "@mokly/mokly";

import { DESTINATIONS } from "../../../parts/destinations.js";
import type { ArtboardViewport } from "../../../parts/shell.js";
import {
  AppearanceHead,
  AppearanceShell,
  AppearanceWorkspace,
} from "../parts/scaffold.js";

function LightOnlyScreen({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <AppearanceShell
      activeLabel="Details"
      design={DESTINATIONS.appearanceLightOnly}
      viewport={viewport}
    >
      <AppearanceHead
        idChip="example-details"
        title="Details"
        viewport={viewport}
      />
      <AppearanceWorkspace subject="details" viewport={viewport} />
    </AppearanceShell>
  );
}

function AutoAppearance({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <AppearanceShell
      activeLabel="Welcome"
      appearanceChoice="auto"
      design={DESTINATIONS.appearanceAuto}
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

/** The Auto setting, and a screen the catalogue cannot show in both schemes. */
export const appearanceStateScreens = [
  screen({
    description:
      "The Appearance setting left on Auto, following the reader's system.",
    desktop: <AutoAppearance viewport="desktop" />,
    id: "design-appearance-auto",
    mobile: <AutoAppearance viewport="mobile" />,
    rationale:
      "Auto is the default and follows the system, including a change made while the catalogue is open. Each generated file depicts the system resolving to the scheme it was rendered for, so the example never reads the building or viewing machine's own setting.",
    slug: "auto",
    title: "Auto appearance",
  }),
  screen({
    description:
      "A screen with no dark render, keeping its light frames while the catalogue changes.",
    desktop: <LightOnlyScreen viewport="desktop" />,
    id: "design-appearance-light-only",
    mobile: <LightOnlyScreen viewport="mobile" />,
    rationale:
      "One setting changes the catalogue and the screens it shows together, but a screen that renders in light only cannot follow. It keeps its real light frames and names that fallback in its caption, which is a fact about the screen rather than a second setting.",
    slug: "light-only",
    title: "Light-only screen",
  }),
];
