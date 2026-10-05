import type { ReactNode } from "react";

import { defineScreen } from "@mokly/mokly";

import { PreviewWorkspace } from "./components/parts/workspace.js";
import { changesDesignMetadata } from "./metadata.js";
import { CompareGrid, Pane } from "./parts/compare.js";
import { ComparePage, FramedShot } from "./parts/compare_page.js";
import { DESTINATIONS, type DesignDestination } from "./parts/destinations.js";
import { DetailsPanel } from "./parts/details.js";
import { ENTRY_PATHS } from "./parts/entry_paths.js";
import { MiniWelcome } from "./parts/mini_screens.js";
import { NavTree } from "./parts/nav.js";
import {
  ExcludedStyleCard,
  MatchedStyleCard,
  StyleReviewNav,
  UnnamedStyleCard,
  UnresolvedStyleCard,
  WelcomeShot,
} from "./parts/review.js";
import { WelcomeHead } from "./parts/screen_heads.js";
import { Shell, type ArtboardViewport } from "./parts/shell.js";

/** A screen kept in Changes by a stylesheet edit opens its loaded comparison. */
function StyleComparison({
  design,
  evidence,
  viewport,
}: {
  design: DesignDestination;
  evidence: ReactNode;
  viewport: ArtboardViewport;
}) {
  return (
    <ComparePage
      design={design}
      evidence={evidence}
      path={ENTRY_PATHS.welcome}
      nav={<StyleReviewNav welcome={design} />}
      state="styles-changed"
      subject="welcome"
      title="Welcome"
      viewport={viewport}
      render={(previewViewport) => (
        <CompareGrid>
          <Pane label="Before" side="before">
            <FramedShot
              address="example.test/welcome"
              viewport={previewViewport}
            >
              <MiniWelcome compact={previewViewport === "mobile"} inert />
            </FramedShot>
          </Pane>
          <Pane label="Current" side="after">
            <FramedShot
              address="example.test/welcome"
              viewport={previewViewport}
            >
              <MiniWelcome
                compact={previewViewport === "mobile"}
                inert
                restyled
              />
            </FramedShot>
          </Pane>
        </CompareGrid>
      )}
    />
  );
}

function MatchedStyles({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <StyleComparison
      design={DESTINATIONS.styleMatched}
      evidence={<MatchedStyleCard />}
      viewport={viewport}
    />
  );
}

function UnresolvedStyles({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <StyleComparison
      design={DESTINATIONS.styleUnresolved}
      evidence={<UnresolvedStyleCard />}
      viewport={viewport}
    />
  );
}

function UnnamedStyles({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <StyleComparison
      design={DESTINATIONS.styleUnnamed}
      evidence={<UnnamedStyleCard />}
      viewport={viewport}
    />
  );
}

function ExcludedStyles({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <Shell
      design={DESTINATIONS.styleExcluded}
      viewport={viewport}
      nav={<NavTree activeLabel="Welcome" changedCount={0} />}
    >
      <WelcomeHead active={viewport} />
      <PreviewWorkspace
        viewport={viewport}
        inspector={
          <DetailsPanel
            subject="welcome"
            comparisonEvidence={<ExcludedStyleCard />}
            open
          />
        }
        render={(previewViewport) => (
          <WelcomeShot viewport={previewViewport} comparison={false} />
        )}
      />
    </Shell>
  );
}

/** Design screens for stylesheet evidence that keeps or releases a screen. */
export const reviewStyleScreens = [
  defineScreen({
    ...changesDesignMetadata,
    colorSchemes: ["light"],
    description:
      "A linked stylesheet changed and some of its changed styles apply here, so the screen stays in Changes, opens its side-by-side comparison, and Details names those styles.",
    desktop: <MatchedStyles viewport="desktop" />,
    slug: "matched",
    mobile: <MatchedStyles viewport="mobile" />,
    title: "Matched styles",
  }),
  defineScreen({
    ...changesDesignMetadata,
    colorSchemes: ["light"],
    description:
      "A linked stylesheet changed in a way that could reach any element, so the screen stays in Changes, opens its side-by-side comparison, and Details names the styles the change could reach.",
    desktop: <UnresolvedStyles viewport="desktop" />,
    slug: "unresolved",
    mobile: <UnresolvedStyles viewport="mobile" />,
    title: "Unresolved styles",
  }),
  defineScreen({
    ...changesDesignMetadata,
    colorSchemes: ["light"],
    description:
      "A linked stylesheet changed in a way with no style name to show, so the screen stays in Changes, opens its side-by-side comparison, and Details says the change can apply anywhere with nothing to list.",
    desktop: <UnnamedStyles viewport="desktop" />,
    slug: "unnamed",
    mobile: <UnnamedStyles viewport="mobile" />,
    rationale:
      "A changed rule without a style name, such as an animation or font rule, keeps the screen in Changes with no list to show. The lead sentence therefore ends with a full stop instead of a colon, and the same wording carries both the listed and the unlisted case.",
    title: "Unnamed styles",
  }),
  defineScreen({
    ...changesDesignMetadata,
    colorSchemes: ["light"],
    description:
      "A linked stylesheet changed but none of its changed styles apply here, so the screen stays out of Changes, offers no comparison, and Details lists the stylesheet as examined and excluded.",
    desktop: <ExcludedStyles viewport="desktop" />,
    slug: "excluded",
    mobile: <ExcludedStyles viewport="mobile" />,
    title: "Excluded styles",
  }),
];
