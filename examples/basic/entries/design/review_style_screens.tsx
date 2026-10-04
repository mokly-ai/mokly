import type { ReactNode } from "react";

import { screen } from "@mokly/mokly";

import { PreviewWorkspace } from "./components/parts/workspace.js";
import { CompareGrid, Pane } from "./parts/compare.js";
import { ComparePage, FramedShot } from "./parts/compare_page.js";
import { DESTINATIONS, type DesignDestination } from "./parts/destinations.js";
import { DetailsPanel } from "./parts/details.js";
import {
  HandbookStage,
  PAGE_STYLE_COUNT,
  PAGE_STYLE_ROWS,
  PageDetails,
} from "./parts/document_page.js";
import { MiniWelcome } from "./parts/mini_screens.js";
import { NavTree } from "./parts/nav.js";
import { EXCLUDED_STYLE_ROWS } from "./parts/nav_data.js";
import {
  ExcludedStyleCard,
  MatchedStyleCard,
  PageStyleCard,
  StyleReviewNav,
  UnnamedStyleCard,
  UnresolvedStyleCard,
  WelcomeShot,
} from "./parts/review.js";
import { WelcomeHead } from "./parts/screen_heads.js";
import { ScreenHead, Shell, type ArtboardViewport } from "./parts/shell.js";

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

/**
 * A changed document opened from Changes. A whole document has no comparison
 * controls, so its Details carry the stylesheet evidence with the page copy.
 */
function PageStyles({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <Shell
      design={DESTINATIONS.stylePage}
      viewport={viewport}
      nav={
        <NavTree
          activeDestination={DESTINATIONS.stylePage}
          changedCount={PAGE_STYLE_COUNT}
          changedOnly
          nodes={PAGE_STYLE_ROWS}
        />
      }
    >
      <ScreenHead
        comparisons={false}
        crumbs={["Example"]}
        idChip="example-handbook"
        status="changed"
        title="Getting started"
      />
      <HandbookStage />
      <PageDetails evidence={<PageStyleCard />} open />
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
    title: "Matched styles",
  }),
  screen({
    colorSchemes: ["light"],
    description:
      "A linked stylesheet changed in a way that could reach any element, so the screen stays in Changes, opens its side-by-side comparison, and Details names the styles the change could reach.",
    desktop: <UnresolvedStyles viewport="desktop" />,
    id: "design-review-style-unresolved",
    mobile: <UnresolvedStyles viewport="mobile" />,
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
    title: "Unnamed styles",
  }),
  screen({
    colorSchemes: ["light"],
    description:
      "Two linked stylesheets changed. One has no changed styles that apply to Welcome and is excluded in Details; the other does apply, so Welcome remains in Changes and opens its comparison.",
    desktop: <ExcludedStyles viewport="desktop" />,
    id: "design-review-style-excluded",
    mobile: <ExcludedStyles viewport="mobile" />,
    title: "Excluded styles",
  }),
  screen({
    colorSchemes: ["light"],
    description:
      "A changed document opened from Changes, with no comparison controls. Details name each changed stylesheet once, with the styles that apply to the page, the styles that also apply outside the changed components, and a change that can apply anywhere on the page.",
    desktop: <PageStyles viewport="desktop" />,
    id: "design-review-style-page",
    mobile: <PageStyles viewport="mobile" />,
    rationale:
      "A document is read whole and never compared, so Details are the only place to show why it is in Changes. Each file keeps its own outcomes, and the sentences say page, so the evidence reads the same way as a screen's without suggesting a comparison.",
    title: "Document page styles",
  }),
];
