import { screen } from "@mokly/mokly";

import {
  DesignAppearanceScope,
  useDarkPreview,
  useRenderedAppearance,
} from "../../../parts/appearance.js";
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

/** The drawer artboard draws the selector holding the scheme it renders for. */
function DrawerTopBar() {
  return (
    <TopBar
      viewport="mobile"
      drawerOpen
      appearanceChoice={useRenderedAppearance()}
    />
  );
}

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
      <DesignAppearanceScope>
        <div className="mbk-shell mbk-shell--collapsed">
          <DrawerTopBar />
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
      aside={<NavDrawer activeLabel="Welcome" />}
      design={DESTINATIONS.appearanceDrawer}
      viewport="mobile"
    >
      <DrawerBody />
    </AppearanceShell>
  );
}

/** Both compared panes show Welcome, so they follow the artboard's scheme. */
function WelcomePanes({ viewport }: { viewport: CompareViewport }) {
  const dark = useDarkPreview();
  return (
    <>
      <Pane label="Before" side="before">
        <FramedShot
          address="example.test/welcome"
          dark={dark}
          viewport={viewport}
        >
          <MiniWelcome compact={viewport === "mobile"} />
        </FramedShot>
      </Pane>
      <Pane label="Current" side="after">
        <FramedShot
          address="example.test/welcome"
          dark={dark}
          viewport={viewport}
        >
          <MiniWelcome compact={viewport === "mobile"} revised />
        </FramedShot>
      </Pane>
    </>
  );
}

function SideBySideCompare({ viewport }: { viewport: CompareViewport }) {
  return (
    <ComparePage
      appearanceChoice={useRenderedAppearance()}
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
      appearanceChoice={useRenderedAppearance()}
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
    description:
      "The catalogue drawer open over a narrow layout, in either appearance.",
    desktop: <NavigationDrawerDesktop />,
    id: "design-appearance-drawer",
    mobile: <NavigationDrawerMobile />,
    rationale:
      "The drawer dims the catalogue behind it while the top bar stays at full strength, so the scrim and the drawer's own elevation need values in each appearance that still separate the two layers.",
    slug: "drawer",
    title: "Navigation drawer",
  }),
  screen({
    description:
      "Two versions of a screen compared side by side, in either appearance.",
    desktop: <SideBySideCompare viewport="desktop" />,
    id: "design-appearance-side-by-side",
    mobile: <SideBySideCompare viewport="mobile" />,
    rationale:
      "The comparison band, the Before and Current captions and the stage behind the frames follow the catalogue appearance, while both compared screens keep the light surfaces they actually render.",
    slug: "side-by-side",
    title: "Side by side",
  }),
  screen({
    description:
      "The blended difference of two screen versions, in either appearance.",
    desktop: <DifferenceCompare viewport="desktop" />,
    id: "design-appearance-difference",
    mobile: <DifferenceCompare viewport="mobile" />,
    rationale:
      "Difference blends the two versions, so the blend sits on an opaque base taken from the compared screens' own colour scheme; the visible difference must be the same whichever appearance the catalogue is using.",
    slug: "difference",
    title: "Difference",
  }),
];
