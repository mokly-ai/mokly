import { defineScreen } from "@mokly/mokly";

import { appearanceDesignMetadata } from "../../../metadata.js";
import {
  DesignAppearanceScope,
  useDarkPreview,
} from "../../../parts/appearance.js";
import { CompareGrid, Pane } from "../../../parts/compare.js";
import {
  ComparePage,
  FramedShot,
  type CompareViewport,
} from "../../../parts/compare_page.js";
import { ComparisonStack, deviceChrome } from "../../../parts/compare_stack.js";
import { DesignNavigation } from "../../../parts/design_navigation.js";
import { DESTINATIONS } from "../../../parts/destinations.js";
import { ENTRY_PATHS } from "../../../parts/entry_paths.js";
import { MiniWelcome } from "../../../parts/mini_screens.js";
import { NavDrawer } from "../../../parts/nav.js";
import { ReviewNav } from "../../../parts/review.js";
import { EmptyState } from "../../../parts/stage_content.js";
import { TopBar } from "../../../parts/top_bar.js";
import { APPEARANCE_NAV_TREE, AppearanceShell } from "../parts/scaffold.js";

import { appearanceInspectorScreens } from "./inspectors.js";

/** The drawer artboard draws the selector holding the scheme it renders for. */
function DrawerTopBar() {
  return <TopBar viewport="mobile" drawerOpen />;
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
          <NavDrawer activeLabel="Welcome" nodes={APPEARANCE_NAV_TREE} />
        </div>
      </DesignAppearanceScope>
    </DesignNavigation>
  );
}

function NavigationDrawerMobile() {
  return (
    <AppearanceShell
      aside={<NavDrawer activeLabel="Welcome" nodes={APPEARANCE_NAV_TREE} />}
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
          <MiniWelcome compact={viewport === "mobile"} inert />
        </FramedShot>
      </Pane>
      <Pane label="Current" side="after">
        <FramedShot
          address="example.test/welcome"
          dark={dark}
          viewport={viewport}
        >
          <MiniWelcome compact={viewport === "mobile"} inert revised />
        </FramedShot>
      </Pane>
    </>
  );
}

/** Difference stacks the same two versions inside one shared chrome. */
function WelcomeStack({ viewport }: { viewport: CompareViewport }) {
  return (
    <ComparisonStack
      after={<MiniWelcome compact={viewport === "mobile"} inert revised />}
      before={<MiniWelcome compact={viewport === "mobile"} inert />}
      chrome={deviceChrome({
        address: "example.test/welcome",
        dark: useDarkPreview(),
        viewport,
      })}
      mode="difference"
    />
  );
}

function SideBySideCompare({ viewport }: { viewport: CompareViewport }) {
  return (
    <ComparePage
      activeTitle="Welcome"
      design={DESTINATIONS.appearanceSideBySide}
      path={ENTRY_PATHS.welcome}
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
      activeTitle="Welcome"
      design={DESTINATIONS.appearanceDifference}
      path={ENTRY_PATHS.welcome}
      mode="difference"
      nav={<ReviewNav activeTitle="Welcome" />}
      render={(previewViewport) => <WelcomeStack viewport={previewViewport} />}
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
  defineScreen({
    ...appearanceDesignMetadata,
    description:
      "The catalogue drawer open over a narrow layout, in either appearance.",
    desktop: <NavigationDrawerDesktop />,
    slug: "drawer",
    mobile: <NavigationDrawerMobile />,
    rationale:
      "The drawer dims the catalogue behind it while the top bar stays at full strength, so the scrim and the drawer's own elevation need values in each appearance that still separate the two layers.",
    title: "Navigation drawer",
  }),
  defineScreen({
    ...appearanceDesignMetadata,
    description:
      "Two versions of a screen compared side by side, in either appearance.",
    desktop: <SideBySideCompare viewport="desktop" />,
    slug: "side-by-side",
    mobile: <SideBySideCompare viewport="mobile" />,
    rationale:
      "The comparison band, the Before and Current captions, the stage behind the frames and both compared screens follow the one catalogue appearance, so a side-by-side read stays in a single scheme rather than mixing chrome and content.",
    title: "Side by side",
  }),
  defineScreen({
    ...appearanceDesignMetadata,
    description:
      "The blended difference of two screen versions, in either appearance.",
    desktop: <DifferenceCompare viewport="desktop" />,
    slug: "difference",
    mobile: <DifferenceCompare viewport="mobile" />,
    rationale:
      "Difference blends the two versions, so the blend needs an opaque base taken from the compared screens rather than the stage behind them. Both versions follow the catalogue appearance together, so the difference stays legible in either one.",
    title: "Difference",
  }),
];
