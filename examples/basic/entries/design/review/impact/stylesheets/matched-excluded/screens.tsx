import { folder, screen } from "@mokly/mokly";

import { PreviewWorkspace } from "../../../../components/parts/workspace.js";
import { DESTINATIONS } from "../../../../parts/destinations.js";
import { DetailsPanel } from "../../../../parts/details.js";
import { NavTree } from "../../../../parts/nav.js";
import { EXCLUDED_STYLE_ROWS } from "../../../../parts/nav_data.js";
import {
  DetailsShot,
  ExcludedOnlyStyleCard,
  MatchedAndExcludedStyleCard,
  WelcomeShot,
} from "../../../../parts/review.js";
import { WelcomeHead } from "../../../../parts/screen_heads.js";
import {
  ScreenHead,
  Shell,
  ViewSwitch,
  type ArtboardViewport,
} from "../../../../parts/shell.js";
import { StyleComparison } from "../../../../parts/style_comparison.js";

/** Welcome in Changes, compared side by side, with the shared Details card. */
function MatchedStyles({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <StyleComparison
      design={DESTINATIONS.styleMatched}
      evidence={<MatchedAndExcludedStyleCard />}
      viewport={viewport}
    />
  );
}

/** The same changed Welcome from All, in Current, with the same Details card. */
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
            comparisonEvidence={<MatchedAndExcludedStyleCard />}
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
 * Details from All in the same branch. It links only the excluded
 * stylesheet, so it stays out of Changes and offers no comparison.
 */
function ExcludedStylesOnly({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <Shell
      design={DESTINATIONS.styleExcludedOnly}
      viewport={viewport}
      nav={
        <NavTree
          activeDestination={DESTINATIONS.styleExcludedOnly}
          changedCount={1}
          nodes={EXCLUDED_STYLE_ROWS}
        />
      }
    >
      <ScreenHead
        action={<ViewSwitch active={viewport} />}
        crumbs={["Example", "Screens"]}
        idChip="example-details"
        status="unmodified"
        title="Details"
      />
      <PreviewWorkspace
        viewport={viewport}
        inspector={
          <DetailsPanel
            subject="details"
            comparisonEvidence={<ExcludedOnlyStyleCard />}
            open
          />
        }
        render={(previewViewport) => <DetailsShot viewport={previewViewport} />}
      />
    </Shell>
  );
}

/**
 * One branch with two changed stylesheets: one keeps Welcome in Changes, and
 * the other applies to neither Welcome nor Details.
 */
export const matchedExcludedDesigns = folder({
  title: "Matched and excluded",
  children: [
    screen({
      colorSchemes: ["light"],
      description:
        "A linked stylesheet changed and some of its changed styles apply here, so Welcome stays in Changes and opens its side-by-side comparison. Details name those styles, then list the other changed stylesheet as examined and excluded.",
      desktop: <MatchedStyles viewport="desktop" />,
      id: "design-review-style-matched",
      mobile: <MatchedStyles viewport="mobile" />,
      rationale:
        "Details come from the same evidence in Changes and in All, so this screen and Excluded styles show one Details card.",
      title: "Matched styles",
    }),
    screen({
      colorSchemes: ["light"],
      description:
        "The same changed Welcome opened from All, with Current selected. One changed stylesheet applies to Welcome and keeps it in Changes; the other applies nowhere on it, so Details list it as examined and excluded.",
      desktop: <ExcludedStyles viewport="desktop" />,
      id: "design-review-style-excluded",
      mobile: <ExcludedStyles viewport="mobile" />,
      rationale:
        "An excluded stylesheet never removes the changes that another stylesheet causes, so Welcome keeps its status and its comparison controls. Its Details are the same as in Matched styles, and the Details row opens the screen that links only the excluded stylesheet.",
      title: "Excluded styles",
    }),
    screen({
      colorSchemes: ["light"],
      description:
        "Details opened from All in the same branch. It links only the stylesheet whose changed styles apply nowhere on it, so it stays out of Changes, shows Unmodified and offers no comparison. Details list that stylesheet as examined and excluded and end with “No changes to this screen.”",
      desktop: <ExcludedStylesOnly viewport="desktop" />,
      id: "design-review-style-excluded-only",
      mobile: <ExcludedStylesOnly viewport="mobile" />,
      rationale:
        "A changed stylesheet with no changed styles that apply never adds a Changes row, a comparison or a stage heading. Details still name it, so a reader can see that the change was examined, and the last line confirms that the screen did not change.",
      title: "Excluded styles only",
    }),
  ],
});
