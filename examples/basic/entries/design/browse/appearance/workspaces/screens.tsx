import { screen } from "@mokly/mokly";

import { DesignAppearanceScope } from "../../../parts/appearance.js";
import { CompareGrid, Pane } from "../../../parts/compare.js";
import {
  ComparePage,
  FramedShot,
  type CompareViewport,
} from "../../../parts/compare_page.js";
import { DesignNavigation } from "../../../parts/design_navigation.js";
import { DESTINATIONS } from "../../../parts/destinations.js";
import { MiniWelcome } from "../../../parts/mini_screens.js";
import { NavDrawer } from "../../../parts/nav.js";
import { ReviewNav } from "../../../parts/review.js";
import { EmptyState } from "../../../parts/stage_content.js";
import { TopBar } from "../../../parts/top_bar.js";
import { AppearanceShell } from "../parts/scaffold.js";

import { appearanceInspectorScreens } from "./inspectors.js";

function DrawerBody() {
  return (
    <EmptyState
      to={DESTINATIONS.appearance}
      title="Mokly"
      body="Browse the mockup catalogue: expand folders and choose an item from the navigation."
      linkLabel="Open the first screen"
    />
  );
}

function NavigationDrawerDesktop() {
  return (
    <DesignNavigation design={DESTINATIONS.appearanceDrawer}>
      <DesignAppearanceScope appearance="dark">
        <div className="mbk-shell mbk-shell--collapsed">
          <TopBar viewport="mobile" drawerOpen appearanceChoice="dark" />
          <main className="mbk-main">
            <DrawerBody />
          </main>
          <NavDrawer activeLabel="Welcome" />
        </div>
      </DesignAppearanceScope>
    </DesignNavigation>
  );
}

function NavigationDrawerMobile() {
  return (
    <AppearanceShell
      appearance="dark"
      appearanceChoice="dark"
      aside={<NavDrawer activeLabel="Welcome" />}
      design={DESTINATIONS.appearanceDrawer}
      viewport="mobile"
    >
      <DrawerBody />
    </AppearanceShell>
  );
}

function WelcomePanes({ viewport }: { viewport: CompareViewport }) {
  return (
    <>
      <Pane label="Before" side="before">
        <FramedShot address="example.test/welcome" viewport={viewport}>
          <MiniWelcome compact={viewport === "mobile"} />
        </FramedShot>
      </Pane>
      <Pane label="Current" side="after">
        <FramedShot address="example.test/welcome" viewport={viewport}>
          <MiniWelcome compact={viewport === "mobile"} revised />
        </FramedShot>
      </Pane>
    </>
  );
}

function SideBySideCompare({ viewport }: { viewport: CompareViewport }) {
  return (
    <ComparePage
      appearance="dark"
      appearanceChoice="dark"
      activeTitle="Welcome"
      design={DESTINATIONS.appearanceSideBySide}
      idChip="example-welcome"
      nav={<ReviewNav activeTitle="Welcome" />}
      render={(previewViewport) => (
        <CompareGrid>
          <WelcomePanes viewport={previewViewport} />
        </CompareGrid>
      )}
      state="changed"
      subject="welcome"
      title="Welcome"
      viewport={viewport}
    />
  );
}

function DifferenceCompare({ viewport }: { viewport: CompareViewport }) {
  return (
    <ComparePage
      appearance="dark"
      appearanceChoice="dark"
      activeTitle="Welcome"
      design={DESTINATIONS.appearanceDifference}
      idChip="example-welcome"
      mode="difference"
      nav={<ReviewNav activeTitle="Welcome" />}
      render={(previewViewport) => (
        <CompareGrid difference>
          <WelcomePanes viewport={previewViewport} />
        </CompareGrid>
      )}
      state="changed"
      subject="welcome"
      title="Welcome"
      viewport={viewport}
    />
  );
}

/** Appearance across the panels and comparisons that fill the main region. */
export const appearanceWorkspaceScreens = [
  ...appearanceInspectorScreens,
  screen({
    colorSchemes: ["light"],
    description:
      "The catalogue drawer open over the dark interface on a narrow layout.",
    desktop: <NavigationDrawerDesktop />,
    id: "design-appearance-drawer",
    mobile: <NavigationDrawerMobile />,
    rationale:
      "The drawer dims the catalogue behind it while the top bar stays at full strength, so the scrim and the drawer's own elevation need dark values that still separate the two layers.",
    slug: "drawer",
    title: "Navigation drawer",
  }),
  screen({
    colorSchemes: ["light"],
    description:
      "Two versions of a screen compared side by side inside the dark interface.",
    desktop: <SideBySideCompare viewport="desktop" />,
    id: "design-appearance-side-by-side",
    mobile: <SideBySideCompare viewport="mobile" />,
    rationale:
      "The comparison band, the Before and Current captions and the stage behind the frames follow the interface, while both compared screens keep the light surfaces they actually render.",
    slug: "side-by-side",
    title: "Side by side",
  }),
  screen({
    colorSchemes: ["light"],
    description:
      "The blended difference of two screen versions inside the dark interface.",
    desktop: <DifferenceCompare viewport="desktop" />,
    id: "design-appearance-difference",
    mobile: <DifferenceCompare viewport="mobile" />,
    rationale:
      "Difference blends the two versions, so the blend sits on an opaque base taken from the compared screens' own colour scheme; the visible difference must be the same whichever appearance the catalogue is using.",
    slug: "difference",
    title: "Difference",
  }),
];
