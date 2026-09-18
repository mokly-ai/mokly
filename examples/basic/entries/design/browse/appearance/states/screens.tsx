import { screen } from "@mokly/mokly";

import { DESTINATIONS } from "../../../parts/destinations.js";
import { ExampleWorkspace } from "../../../parts/example_workspace.js";
import type { ArtboardViewport } from "../../../parts/shell.js";
import { AppearanceHead, AppearanceShell } from "../parts/scaffold.js";

function LightPreview({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <AppearanceShell
      activeLabel="Welcome"
      design={DESTINATIONS.appearanceLightPreview}
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

function DarkPreview({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <AppearanceShell
      activeLabel="Welcome"
      design={DESTINATIONS.appearanceDarkPreview}
      viewport={viewport}
    >
      <AppearanceHead
        idChip="example-welcome"
        title="Welcome"
        viewport={viewport}
      />
      <ExampleWorkspace subject="welcome" viewport={viewport} dark />
    </AppearanceShell>
  );
}

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
      <ExampleWorkspace subject="details" viewport={viewport} lightOnly />
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
      <ExampleWorkspace subject="welcome" viewport={viewport} />
    </AppearanceShell>
  );
}

/** The preview scheme a mockup holds, and the Auto setting, in both appearances. */
export const appearanceStateScreens = [
  screen({
    description:
      "A screen showing its light view, with the catalogue in either appearance.",
    desktop: <LightPreview viewport="desktop" />,
    id: "design-appearance-light-preview",
    mobile: <LightPreview viewport="mobile" />,
    rationale:
      "The preview colour scheme is chosen in the depicted screen header and reaches only the device screens, so a light screen reads the same whichever appearance the catalogue around it is using.",
    slug: "light-preview",
    title: "Light preview",
  }),
  screen({
    description:
      "A screen showing its dark view, with the catalogue in either appearance.",
    desktop: <DarkPreview viewport="desktop" />,
    id: "design-appearance-dark-preview",
    mobile: <DarkPreview viewport="mobile" />,
    rationale:
      "A dark screen inside a light catalogue and inside a dark one are both supported, so the phone screen edge and the browser toolbar still have to separate the preview from the catalogue around it.",
    slug: "dark-preview",
    title: "Dark preview",
  }),
  screen({
    description:
      "A screen with no dark view keeping its light frames in either appearance.",
    desktop: <LightOnlyScreen viewport="desktop" />,
    id: "design-appearance-light-only",
    mobile: <LightOnlyScreen viewport="mobile" />,
    rationale:
      "A screen that renders in light only keeps its real light frames and states that fallback in its frame caption. That is a fact about the screen, so it never makes the catalogue around it light-only.",
    slug: "light-only",
    title: "Light-only screen",
  }),
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
];
