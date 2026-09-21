import { screen } from "@mokly/mokly";

import { PreviewWorkspace } from "./components/parts/workspace.js";
import { DESTINATIONS, type DesignDestination } from "./parts/destinations.js";
import { DetailsPanel } from "./parts/details.js";
import { MiniWelcome } from "./parts/mini_screens.js";
import type { ChangesStatus } from "./parts/nav.js";
import { AvailabilityNav } from "./parts/review.js";
import {
  ScreenHead,
  Shell,
  ViewSwitch,
  type ArtboardViewport,
} from "./parts/shell.js";
import { BrowserFrame, PhoneFrame } from "./parts/stage.js";

function WelcomeShot({ viewport }: { viewport: ArtboardViewport }) {
  return viewport === "desktop" ? (
    <BrowserFrame address="example.test/welcome">
      <MiniWelcome />
    </BrowserFrame>
  ) : (
    <PhoneFrame small>
      <MiniWelcome compact />
    </PhoneFrame>
  );
}

/**
 * Changes is selected while the comparison cannot answer yet. The tabs, the
 * count slot and the tree origin hold their positions, and All stays a link.
 */
function AvailabilityScreen({
  design,
  status,
  viewport,
}: {
  design: DesignDestination;
  status: ChangesStatus;
  viewport: ArtboardViewport;
}) {
  return (
    <Shell
      design={design}
      viewport={viewport}
      nav={<AvailabilityNav status={status} />}
      aside={
        viewport === "mobile" ? (
          <AvailabilityNav drawer status={status} />
        ) : null
      }
    >
      <ScreenHead
        action={<ViewSwitch active={viewport} />}
        crumbs={["Example", "Screens"]}
        idChip="example-welcome"
        title="Welcome"
      />
      <PreviewWorkspace
        viewport={viewport}
        inspector={<DetailsPanel subject="welcome" />}
        render={(previewViewport) => <WelcomeShot viewport={previewViewport} />}
      />
    </Shell>
  );
}

/** Changes states that keep the catalogue usable before a comparison exists. */
export const reviewAvailabilityScreens = [
  screen({
    colorSchemes: ["light"],
    description:
      "Changes is selected while the comparison is still being prepared; the count slot spins and All stays usable.",
    desktop: (
      <AvailabilityScreen
        design={DESTINATIONS.preparing}
        status="preparing"
        viewport="desktop"
      />
    ),
    id: "design-review-preparing",
    mobile: (
      <AvailabilityScreen
        design={DESTINATIONS.preparing}
        status="preparing"
        viewport="mobile"
      />
    ),
    rationale:
      "Reviewers approve a distinct preparing state before the comparison data exists, separate from the pending check that follows it.",
    slug: "preparing",
    title: "Preparing comparison",
  }),
  screen({
    colorSchemes: ["light"],
    description:
      "The comparison could not be prepared, so Changes keeps the unavailable message and a dash in the count slot.",
    desktop: (
      <AvailabilityScreen
        design={DESTINATIONS.unavailable}
        status="unavailable"
        viewport="desktop"
      />
    ),
    id: "design-review-unavailable",
    mobile: (
      <AvailabilityScreen
        design={DESTINATIONS.unavailable}
        status="unavailable"
        viewport="mobile"
      />
    ),
    rationale:
      "A failed preparation must reuse the one unavailable presentation instead of naming why the comparison is missing.",
    slug: "unavailable",
    title: "Comparison unavailable",
  }),
];
