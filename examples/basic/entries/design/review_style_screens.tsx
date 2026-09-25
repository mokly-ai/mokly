import type { ReactNode } from "react";

import { screen } from "@mokly/mokly";

import { PreviewWorkspace } from "./components/parts/workspace.js";
import { CompareGrid, Pane } from "./parts/compare.js";
import { ComparePage, FramedShot } from "./parts/compare_page.js";
import { DESTINATIONS, type DesignDestination } from "./parts/destinations.js";
import { DetailsPanel } from "./parts/details.js";
import { MiniWelcome } from "./parts/mini_screens.js";
import { NavTree } from "./parts/nav.js";
import { EXCLUDED_STYLE_ROWS } from "./parts/nav_data.js";
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
      idChip="example-welcome"
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
              <MiniWelcome compact={previewViewport === "mobile"} />
            </FramedShot>
          </Pane>
          <Pane label="Current" side="after">
            <FramedShot
              address="example.test/welcome"
              viewport={previewViewport}
            >
              <MiniWelcome compact={previewViewport === "mobile"} restyled />
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
      nav={
        <NavTree
          activeDestination={DESTINATIONS.styleExcluded}
          changedCount={1}
          nodes={EXCLUDED_STYLE_ROWS}
        />
      }
    >
      <WelcomeHead active={viewport} changed />
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
  screen({
    colorSchemes: ["light"],
    description:
      "A linked stylesheet changed and some of its changed styles apply here, so the screen stays in Changes, opens its side-by-side comparison, and Details names those styles.",
    desktop: <MatchedStyles viewport="desktop" />,
    id: "design-review-style-matched",
    mobile: <MatchedStyles viewport="mobile" />,
    slug: "matched",
    title: "Matched styles",
  }),
  screen({
    colorSchemes: ["light"],
    description:
      "A linked stylesheet changed in a way that could reach any element, so the screen stays in Changes, opens its side-by-side comparison, and Details names the styles the change could reach.",
    desktop: <UnresolvedStyles viewport="desktop" />,
    id: "design-review-style-unresolved",
    mobile: <UnresolvedStyles viewport="mobile" />,
    slug: "unresolved",
    title: "Unresolved styles",
  }),
  screen({
    colorSchemes: ["light"],
    description:
      "A linked stylesheet changed in a way with no style name to show, so the screen stays in Changes, opens its side-by-side comparison, and Details says the change can apply anywhere with nothing to list.",
    desktop: <UnnamedStyles viewport="desktop" />,
    id: "design-review-style-unnamed",
    mobile: <UnnamedStyles viewport="mobile" />,
    rationale:
      "A changed rule without a style name, such as an animation or font rule, keeps the screen in Changes with no list to show. The lead sentence therefore ends with a full stop instead of a colon, and the same wording carries both the listed and the unlisted case.",
    slug: "unnamed",
    title: "Unnamed styles",
  }),
  screen({
    colorSchemes: ["light"],
    description:
      "Two linked stylesheets changed. One has no changed styles that apply to Welcome and is excluded in Details; the other does apply, so Welcome remains in Changes and opens its comparison.",
    desktop: <ExcludedStyles viewport="desktop" />,
    id: "design-review-style-excluded",
    mobile: <ExcludedStyles viewport="mobile" />,
    slug: "excluded",
    title: "Excluded styles",
  }),
];
