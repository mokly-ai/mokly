import { defineScreen } from "@mokly/mokly";

import { PreviewWorkspace } from "./components/parts/workspace.js";
import { changesDesignMetadata } from "./metadata.js";
import { DESTINATIONS } from "./parts/destinations.js";
import { DetailsPanel } from "./parts/details.js";
import { NavDrawer, NavTree } from "./parts/nav.js";
import {
  EmptyReviewNav,
  IgnoredImpactCard,
  WelcomeShot,
} from "./parts/review.js";
import { WelcomeHead } from "./parts/screen_heads.js";
import { Shell } from "./parts/shell.js";

type ReviewViewport = "desktop" | "mobile";

function IgnoredOnlyCompare({ viewport }: { viewport: ReviewViewport }) {
  return (
    <Shell
      design={DESTINATIONS.ignored}
      viewport={viewport}
      nav={<NavTree activeLabel="Welcome" changedCount={0} />}
    >
      <WelcomeHead active={viewport} />
      <PreviewWorkspace
        viewport={viewport}
        inspector={
          <DetailsPanel
            subject="welcome"
            comparisonEvidence={<IgnoredImpactCard />}
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

function EmptyChanges({ viewport }: { viewport: ReviewViewport }) {
  return (
    <Shell
      design={DESTINATIONS.empty}
      viewport={viewport}
      nav={<EmptyReviewNav />}
      aside={
        viewport === "mobile" ? (
          <NavDrawer changedOnly changedCount={0} nodes={[]} />
        ) : null
      }
    >
      <WelcomeHead active={viewport} changes />
      <PreviewWorkspace
        viewport={viewport}
        inspector={<DetailsPanel subject="welcome" />}
        render={(previewViewport) => (
          <WelcomeShot viewport={previewViewport} comparison={false} />
        )}
      />
    </Shell>
  );
}

/** Design screens for ignored comparison evidence and an empty Changes filter. */
export const reviewImpactScreens = [
  defineScreen({
    ...changesDesignMetadata,
    colorSchemes: ["light"],
    description: "A screen whose only differences fall inside ignored regions.",
    desktop: <IgnoredOnlyCompare viewport="desktop" />,
    slug: "ignored-only",
    mobile: <IgnoredOnlyCompare viewport="mobile" />,
    title: "Ignored only",
  }),
  defineScreen({
    ...changesDesignMetadata,
    colorSchemes: ["light"],
    description:
      "Changes has no matching screens; the selected Current view remains available.",
    desktop: <EmptyChanges viewport="desktop" />,
    slug: "empty",
    mobile: <EmptyChanges viewport="mobile" />,
    title: "No changes",
  }),
];
