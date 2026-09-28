import { screen } from "@mokly/mokly";

import { PreviewWorkspace } from "./components/parts/workspace.js";
import { useDarkPreview } from "./parts/appearance.js";
import { CompareGrid, ComparisonStage, Pane } from "./parts/compare.js";
import { FramedShot } from "./parts/compare_page.js";
import { ScrolledPage } from "./parts/compare_scroll.js";
import { ComparisonStack, deviceChrome } from "./parts/compare_stack.js";
import {
  DESTINATIONS,
  type ComparisonMode,
  type DesignDestination,
} from "./parts/destinations.js";
import { DetailsPanel } from "./parts/details.js";
import { MiniWelcomeApp } from "./parts/mini_app_shell.js";
import { MiniWelcome, MiniWelcomePage } from "./parts/mini_screens.js";
import { ReviewNav } from "./parts/review.js";
import {
  ScreenHead,
  Shell,
  ViewSwitch,
  type ArtboardViewport,
} from "./parts/shell.js";
import { BrowserFrame, PhoneFrame } from "./parts/stage.js";

/**
 * Welcome in Current; in Overlay, part-way down a long screen, and with an app
 * shell's panel part-way down; and Side by side with Scroll together off.
 */
type ChangesState =
  | "current"
  | "overlay"
  | "overlay-long"
  | "overlay-panel"
  | "side-by-side-apart";

/** The Overlay states, which differ only in the Welcome they depict. */
type OverlayState = Extract<
  ChangesState,
  "overlay" | "overlay-long" | "overlay-panel"
>;

const DESIGNS: Record<ChangesState, DesignDestination> = {
  current: DESTINATIONS.current,
  overlay: DESTINATIONS.overlay,
  "overlay-long": DESTINATIONS.overlayLong,
  "overlay-panel": DESTINATIONS.overlayPanel,
  "side-by-side-apart": DESTINATIONS.sideBySideApart,
};

const MODES: Record<ChangesState, ComparisonMode> = {
  current: "current",
  overlay: "overlay",
  "overlay-long": "overlay",
  "overlay-panel": "overlay",
  "side-by-side-apart": "side-by-side",
};

function CurrentPreview({ viewport }: { viewport: ArtboardViewport }) {
  const dark = useDarkPreview();
  const content = <MiniWelcome compact={viewport === "mobile"} />;
  return viewport === "mobile" ? (
    <PhoneFrame dark={dark} small>
      {content}
    </PhoneFrame>
  ) : (
    <BrowserFrame address="example.test/welcome" dark={dark}>
      {content}
    </BrowserFrame>
  );
}

function OverlayPreview({
  state,
  viewport,
}: {
  state: OverlayState;
  viewport: ArtboardViewport;
}) {
  const compact = viewport === "mobile";
  const welcome = (revised: boolean) =>
    state === "overlay-panel" ? (
      <MiniWelcomeApp compact={compact} revised={revised} />
    ) : (
      <MiniWelcome
        compact={compact}
        inert
        long={state === "overlay-long"}
        revised={revised}
      />
    );
  return (
    <ComparisonStack
      after={welcome(true)}
      before={welcome(false)}
      chrome={deviceChrome({
        address: "example.test/welcome",
        dark: useDarkPreview(),
        viewport,
      })}
      mode="overlay"
      scrolled={state === "overlay-long"}
    />
  );
}

/** Scroll together is off, so each version sits where its reader left it. */
function ApartPreview({ viewport }: { viewport: ArtboardViewport }) {
  const dark = useDarkPreview();
  const version = (side: "after" | "before") => (
    <Pane label={side === "before" ? "Before" : "Current"} side={side}>
      <FramedShot
        address="example.test/welcome"
        dark={dark}
        viewport={viewport}
      >
        <ScrolledPage offset={side === "before" ? "short" : "long"}>
          <MiniWelcomePage
            compact={viewport === "mobile"}
            revised={side === "after"}
          />
        </ScrolledPage>
      </FramedShot>
    </Pane>
  );
  return (
    <CompareGrid>
      {version("before")}
      {version("after")}
    </CompareGrid>
  );
}

function ChangesScreen({
  state,
  viewport,
}: {
  state: ChangesState;
  viewport: ArtboardViewport;
}) {
  const mode = MODES[state];
  const comparing = state !== "current";
  return (
    <Shell
      design={DESIGNS[state]}
      viewport={viewport}
      nav={<ReviewNav activeTitle="Welcome" />}
    >
      <ScreenHead
        comparisons
        comparisonMode={mode}
        scrollTogether={state !== "side-by-side-apart"}
        action={<ViewSwitch active={viewport} />}
        crumbs={["Example", "Screens"]}
        idChip="example-welcome"
        title="Welcome"
      />
      <PreviewWorkspace
        viewport={viewport}
        stage={!comparing}
        inspector={
          <DetailsPanel
            subject="welcome"
            comparisonEvidence={comparing || undefined}
            open={state === "overlay"}
          />
        }
        render={(previewViewport) =>
          state === "current" ? (
            <CurrentPreview viewport={previewViewport} />
          ) : (
            <ComparisonStage state="changed" viewport={previewViewport}>
              {state === "side-by-side-apart" ? (
                <ApartPreview viewport={previewViewport} />
              ) : (
                <OverlayPreview state={state} viewport={previewViewport} />
              )}
            </ComparisonStage>
          )
        }
      />
    </Shell>
  );
}

/** On-demand comparison controls share the normal catalogue screen. */
export const changesScreens = [
  screen({
    description:
      "Changes opens a screen in Current; comparison starts only after selecting a diff option, in either catalogue scheme.",
    desktop: <ChangesScreen state="current" viewport="desktop" />,
    id: "design-changes-current",
    mobile: <ChangesScreen state="current" viewport="mobile" />,
    slug: "current",
    title: "Current screen in Changes",
  }),
  screen({
    description:
      "Overlay compares the selected screen in place, with the same controls also available from All, in either catalogue scheme.",
    desktop: <ChangesScreen state="overlay" viewport="desktop" />,
    id: "design-changes-overlay",
    mobile: <ChangesScreen state="overlay" viewport="mobile" />,
    rationale:
      "Both versions share one frame, so the comparison reads as one screen: the current version sits over the previous one at half strength, and links inside it do nothing.",
    slug: "overlay",
    title: "On-demand overlay",
  }),
  screen({
    description:
      "Overlay on a screen longer than its frame scrolls both versions together, in either catalogue scheme.",
    desktop: <ChangesScreen state="overlay-long" viewport="desktop" />,
    id: "design-changes-overlay-long",
    mobile: <ChangesScreen state="overlay-long" viewport="mobile" />,
    rationale:
      "A long screen scrolls inside the one frame both versions share, so they always sit at the same position: unchanged sections line up exactly and only the reworded section shows both versions, wherever the reader stops.",
    slug: "overlay-long",
    title: "Overlay on a long screen",
  }),
  screen({
    description:
      "Overlay on a screen whose main panel scrolls while its top bar and navigation stay in place, with both versions' panels at one position, in either catalogue scheme.",
    desktop: <ChangesScreen state="overlay-panel" viewport="desktop" />,
    id: "design-changes-overlay-panel",
    mobile: <ChangesScreen state="overlay-panel" viewport="mobile" />,
    rationale:
      "An app-style screen keeps its page still and scrolls a panel inside it, so the frame has nothing to scroll. With Scroll together on, the panel moves in both versions at once: the top bar and navigation line up exactly and only the reworded section shows both versions.",
    slug: "overlay-panel",
    title: "Overlay on a scrolling panel",
  }),
  screen({
    description:
      "Side by side with Scroll together turned off, each version left at its own place on the screen, in either catalogue scheme.",
    desktop: <ChangesScreen state="side-by-side-apart" viewport="desktop" />,
    id: "design-changes-side-by-side-apart",
    mobile: <ChangesScreen state="side-by-side-apart" viewport="mobile" />,
    rationale:
      "Turning Scroll together off lets the reader move each version on its own to compare parts that moved, so the two frames can show different places. Nothing moves when it is switched off, and switching it back on brings the other version to the one scrolled last.",
    slug: "side-by-side-apart",
    title: "Side by side, scrolled apart",
  }),
];
