import { screen } from "@mokly/mokly";

import { DESTINATIONS } from "../../../parts/destinations.js";
import { REMOVED_SCREENS } from "../../../parts/nav_data.js";
import {
  PreviewLoading,
  PreviewUnavailable,
} from "../../../parts/removed_preview.js";
import { RemovedScreen, RemovedView } from "../../../parts/removed_screen.js";
import { MiniSurvey } from "../../../parts/removed_shots.js";

type Viewport = "desktop" | "mobile";

function LongPreview({ viewport }: { viewport: Viewport }) {
  return (
    <RemovedScreen
      entry={REMOVED_SCREENS.survey}
      preview={(previewViewport) => (
        <RemovedView
          address="example.test/survey"
          compact={viewport === "mobile"}
          viewport={previewViewport}
        >
          <MiniSurvey compact={previewViewport === "mobile"} />
        </RemovedView>
      )}
      subject="survey"
      viewport={viewport}
    />
  );
}

function Loading({ viewport }: { viewport: Viewport }) {
  return (
    <RemovedScreen
      entry={REMOVED_SCREENS.invite}
      state={<PreviewLoading />}
      subject="invite"
      viewport={viewport}
    />
  );
}

function Unavailable({ viewport }: { viewport: Viewport }) {
  return (
    <RemovedScreen
      entry={REMOVED_SCREENS.archive}
      state={<PreviewUnavailable to={DESTINATIONS.removed} />}
      subject="archive"
      viewport={viewport}
    />
  );
}

/** Previous-version states a removed screen reaches before it can be read. */
export const removedOutcomeScreens = [
  screen({
    colorSchemes: ["light"],
    description:
      "A tall previous screen scrolls inside its own device frame rather than being cropped to it.",
    desktop: <LongPreview viewport="desktop" />,
    id: "design-review-removed-long",
    mobile: <LongPreview viewport="mobile" />,
    rationale:
      "Reading a removed screen means moving through it, so the previous views keep the screen's own scrolling and in-screen positions instead of collapsing to a single visible region.",
    slug: "long-preview",
    title: "Long previous screen",
  }),
  screen({
    colorSchemes: ["light"],
    description:
      "Selecting a removed screen shows a loading stage until its previous views arrive.",
    desktop: <Loading viewport="desktop" />,
    id: "design-review-removed-loading",
    mobile: <Loading viewport="mobile" />,
    rationale:
      "Previous views are retrieved only when the screen is opened, so the wait belongs on the stage while the navigation, badge, and details stay in place.",
    slug: "loading",
    title: "Loading previous screen",
  }),
  screen({
    colorSchemes: ["light"],
    description:
      "Previous views that could not be loaded offer Retry and keep the catalogue usable.",
    desktop: <Unavailable viewport="desktop" />,
    id: "design-review-removed-unavailable",
    mobile: <Unavailable viewport="mobile" />,
    rationale:
      "Current output may never stand in for missing history, so the stage says plainly that the previous version is unavailable and offers one repeatable action rather than naming a reason.",
    slug: "unavailable",
    title: "Previous screen unavailable",
  }),
];
