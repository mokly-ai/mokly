import { screen } from "@mokly/mokly";

import { DESTINATIONS } from "../../../parts/destinations.js";
import { ExampleWorkspace } from "../../../parts/example_workspace.js";
import type { ArtboardViewport } from "../../../parts/shell.js";
import { AppearanceHead, AppearanceShell } from "../parts/scaffold.js";

function LightInterface({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <AppearanceShell
      activeLabel="Welcome"
      appearance="light"
      appearanceChoice="light"
      design={DESTINATIONS.appearanceLight}
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

function LightInterfaceDarkPreview({
  viewport,
}: {
  viewport: ArtboardViewport;
}) {
  return (
    <AppearanceShell
      activeLabel="Welcome"
      appearance="light"
      appearanceChoice="light"
      design={DESTINATIONS.appearanceLightDark}
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

function DarkInterface({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <AppearanceShell
      activeLabel="Welcome"
      appearance="dark"
      appearanceChoice="dark"
      design={DESTINATIONS.appearanceDark}
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

function DarkInterfaceLightOnly({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <AppearanceShell
      activeLabel="Details"
      appearance="dark"
      appearanceChoice="dark"
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
      appearance="light"
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

/** The four interface and preview pairings, plus the Auto setting itself. */
export const appearanceStateScreens = [
  screen({
    colorSchemes: ["light"],
    description:
      "The light interface holding the light view of a screen, with Light chosen.",
    desktop: <LightInterface viewport="desktop" />,
    id: "design-appearance-light",
    mobile: <LightInterface viewport="mobile" />,
    rationale:
      "Choosing Light keeps the established catalogue layout, spacing and colours, so an existing reviewer sees no change beyond the new setting.",
    slug: "light",
    title: "Light interface",
  }),
  screen({
    colorSchemes: ["light"],
    description:
      "The light interface holding the dark view of a screen, with Light chosen.",
    desktop: <LightInterfaceDarkPreview viewport="desktop" />,
    id: "design-appearance-light-dark",
    mobile: <LightInterfaceDarkPreview viewport="mobile" />,
    rationale:
      "The preview colour scheme is chosen in the screen header and reaches only the device screens, so a light catalogue can show a dark screen exactly as it does today.",
    slug: "light-dark",
    title: "Light interface, dark screen",
  }),
  screen({
    colorSchemes: ["light"],
    description:
      "The dark interface holding the dark view of a screen, with Dark chosen.",
    desktop: <DarkInterface viewport="desktop" />,
    id: "design-appearance-dark",
    mobile: <DarkInterface viewport="mobile" />,
    rationale:
      "Both settings are dark here, so the phone screen edge, the browser toolbar and the stage still have to separate the preview from the surrounding catalogue.",
    slug: "dark",
    title: "Dark interface, dark screen",
  }),
  screen({
    colorSchemes: ["light"],
    description:
      "A screen with no dark view keeping its light frames inside the dark interface.",
    desktop: <DarkInterfaceLightOnly viewport="desktop" />,
    id: "design-appearance-light-only",
    mobile: <DarkInterfaceLightOnly viewport="mobile" />,
    rationale:
      "A screen that renders in light only keeps its real light frames and states that fallback in the frame caption, so a reviewer can tell a light screen from a missing dark one whatever the interface is set to.",
    slug: "light-only",
    title: "Light-only screen",
  }),
  screen({
    colorSchemes: ["light"],
    description:
      "The Appearance setting left on Auto, following the reader's system.",
    desktop: <AutoAppearance viewport="desktop" />,
    id: "design-appearance-auto",
    mobile: <AutoAppearance viewport="mobile" />,
    rationale:
      "Auto is the default and follows the system, including a change made while the catalogue is open; this artboard records how it reads on a system currently set to light.",
    slug: "auto",
    title: "Auto appearance",
  }),
];
