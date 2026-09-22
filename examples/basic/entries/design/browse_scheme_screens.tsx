import type { ScreenVariantInput } from "@mokly/mokly";

import { DESTINATIONS } from "./parts/destinations.js";
import { ExampleWorkspace } from "./parts/example_workspace.js";
import { NavTree } from "./parts/nav.js";
import { ScreenHead, Shell, ViewSwitch } from "./parts/shell.js";

type SchemeViewport = "desktop" | "mobile";

function SchemeHead({
  idChip,
  unmodified = false,
  title,
  viewport,
}: {
  idChip: string;
  unmodified?: boolean;
  title: string;
  viewport: SchemeViewport;
}) {
  return (
    <ScreenHead
      action={
        <ViewSwitch active={viewport === "desktop" ? "both" : "mobile"} />
      }
      crumbs={["Example", "Screens"]}
      idChip={idChip}
      title={title}
      {...(unmodified ? { status: "unmodified" as const } : {})}
    />
  );
}

function DarkSchemeDesktop() {
  return (
    <Shell
      design={DESTINATIONS.darkWelcome}
      viewport="desktop"
      nav={<NavTree activeLabel="Welcome" />}
    >
      <SchemeHead idChip="example-welcome" title="Welcome" viewport="desktop" />
      <ExampleWorkspace subject="welcome" viewport="desktop" dark />
    </Shell>
  );
}

function DarkSchemeMobile() {
  return (
    <Shell design={DESTINATIONS.darkWelcome} viewport="mobile" nav={null}>
      <SchemeHead idChip="example-welcome" title="Welcome" viewport="mobile" />
      <ExampleWorkspace subject="welcome" viewport="mobile" dark />
    </Shell>
  );
}

function LightOnlyDesktop() {
  return (
    <Shell
      design={DESTINATIONS.darkDetails}
      viewport="desktop"
      nav={<NavTree activeLabel="Details" />}
    >
      <SchemeHead
        idChip="example-details"
        title="Details"
        viewport="desktop"
        unmodified
      />
      <ExampleWorkspace subject="details" viewport="desktop" lightOnly />
    </Shell>
  );
}

function LightOnlyMobile() {
  return (
    <Shell design={DESTINATIONS.darkDetails} viewport="mobile" nav={null}>
      <SchemeHead
        idChip="example-details"
        title="Details"
        viewport="mobile"
        unmodified
      />
      <ExampleWorkspace subject="details" viewport="mobile" lightOnly />
    </Shell>
  );
}

/** Welcome variants for the light and dark color-scheme states. */
export const browseSchemeVariants = [
  {
    colorSchemes: ["light"],
    description:
      "The catalogue with the dark scheme selected and dark device screens.",
    desktop: <DarkSchemeDesktop />,
    id: "design-browse-dark-scheme",
    mobile: <DarkSchemeMobile />,
    rationale:
      "Dark applies inside the device screens only (--mbk-dark-screen-bg #121514, --mbk-dark-screen-ink #eef1ef); bezels, the browser bar, and every shell surface stay light so the catalogue frame reads the same in both schemes. The theme icon sits beside the viewport dropdown in the screen header on both wide and narrow layouts.",
    slug: "dark-scheme",
    title: "Dark scheme selected",
  },
  {
    colorSchemes: ["light"],
    description:
      "A screen with no dark render keeping light device screens under the dark selection.",
    desktop: <LightOnlyDesktop />,
    id: "design-browse-light-only",
    mobile: <LightOnlyMobile />,
    rationale:
      "A screen that renders in light only keeps its light frames instead of being tinted, and its frame label states the fallback so a reviewer can tell a light render from a missing dark one. The selection itself stays on dark for the rest of the catalogue.",
    slug: "light-only",
    title: "Light-only screen under dark",
  },
] satisfies readonly ScreenVariantInput[];
