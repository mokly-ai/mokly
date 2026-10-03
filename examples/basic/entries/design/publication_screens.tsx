import { screen } from "@mokly/mokly";

import { DESTINATIONS } from "./parts/destinations.js";
import { DetailsPanel } from "./parts/details.js";
import { MiniWelcome } from "./parts/mini_screens.js";
import { NavTree } from "./parts/nav.js";
import {
  ScreenHead,
  Shell,
  ViewSwitch,
  type ArtboardViewport,
} from "./parts/shell.js";
import { BrowserFrame, PhoneFrame, Stage } from "./parts/stage.js";

function CatalogueView({
  viewport,
  changes,
}: {
  viewport: ArtboardViewport;
  changes: boolean;
}) {
  return (
    <Shell
      design={
        changes ? DESTINATIONS.publicationChanges : DESTINATIONS.publication
      }
      viewport={viewport}
      nav={<NavTree changes={changes} activeLabel="Welcome" />}
    >
      <ScreenHead
        comparisons={changes}
        crumbs={["Example", "Screens"]}
        idChip="example-welcome"
        title="Welcome"
        action={
          <>
            <ViewSwitch active={viewport} />
          </>
        }
      />
      <Stage>
        {viewport === "desktop" ? (
          <BrowserFrame address="example.test/welcome" label="Desktop">
            <MiniWelcome />
          </BrowserFrame>
        ) : (
          <PhoneFrame small label="Mobile">
            <MiniWelcome compact />
          </PhoneFrame>
        )}
      </Stage>
      <DetailsPanel subject="welcome" />
    </Shell>
  );
}
function CatalogueDesktop() {
  return <CatalogueView viewport="desktop" changes={false} />;
}
function CatalogueMobile() {
  return <CatalogueView viewport="mobile" changes={false} />;
}
function ChangesDesktop() {
  return <CatalogueView viewport="desktop" changes />;
}
function ChangesMobile() {
  return <CatalogueView viewport="mobile" changes />;
}

/** Owning designs for a catalogue with review omitted or included. */
export const publicationScreens = [
  screen({
    id: "design-publication-catalogue",
    title: "Current catalogue",
    description: "Navigation, search and variants with review omitted.",
    colorSchemes: ["light"],
    desktop: <CatalogueDesktop />,
    mobile: <CatalogueMobile />,
  }),
  screen({
    id: "design-publication-changes",
    title: "Catalogue with Changes",
    description:
      "The same catalogue with Changes and optional screen comparisons.",
    colorSchemes: ["light"],
    desktop: <ChangesDesktop />,
    mobile: <ChangesMobile />,
  }),
];
