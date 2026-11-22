import { defineScreen } from "@mokly/mokly";

import { FlowStage } from "../../../../../../../packages/ui/src/flow-step/flow-step.js";
import { CANVAS_PAGES } from "../../../canvas/parts/destinations.js";
import { appearanceDesignMetadata } from "../../../metadata.js";
import { useDarkPreview } from "../../../parts/appearance.js";
import { artboards } from "../../../parts/artboards.js";
import { DESTINATIONS } from "../../../parts/destinations.js";
import { ENTRY_PATHS } from "../../../parts/entry_paths.js";
import { MiniDetails, MiniWelcome } from "../../../parts/mini_screens.js";
import type { ArtboardViewport } from "../../../parts/shell.js";
import { BrowserFrame, PhoneFrame } from "../../../parts/stage.js";
import { FlowStep } from "../../../parts/stage_content.js";
import { AppearanceHead, AppearanceShell } from "../parts/scaffold.js";

/** The flow's first step shows Welcome, which follows the artboard's scheme. */
function FlowWelcomeShot({ viewport }: { viewport: ArtboardViewport }) {
  const dark = useDarkPreview();
  return viewport === "desktop" ? (
    <BrowserFrame address="example.test/welcome" dark={dark}>
      <MiniWelcome />
    </BrowserFrame>
  ) : (
    <PhoneFrame small dark={dark}>
      <MiniWelcome compact />
    </PhoneFrame>
  );
}

/** The use case's steps. Each step opens the Canvas artboard of its screen. */
function UseCaseFlow({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <AppearanceShell
      activeLabel="Example tour"
      design={DESTINATIONS.appearanceFlow}
      viewport={viewport}
    >
      <AppearanceHead
        crumbs={["Example"]}
        path={ENTRY_PATHS.tour}
        preview="none"
        title="Example tour"
        viewport={viewport}
      />
      <FlowStage>
        <FlowStep
          name="arrival"
          number={1}
          title="Welcome"
          screenTitle="Welcome"
          description="The tour starts on the landing screen."
          screenPath={CANVAS_PAGES.overview}
        >
          <FlowWelcomeShot viewport={viewport} />
        </FlowStep>
        <FlowStep
          name="detail"
          number={2}
          title="Details"
          screenTitle="Details"
          description="The tour ends on the details screen."
          screenPath={CANVAS_PAGES.added}
        >
          {viewport === "desktop" ? (
            <BrowserFrame address="example.test/details">
              <MiniDetails />
            </BrowserFrame>
          ) : (
            <PhoneFrame small>
              <MiniDetails compact />
            </PhoneFrame>
          )}
        </FlowStep>
      </FlowStage>
    </AppearanceShell>
  );
}

/**
 * A use case in either appearance. It stays until decision 33 settles how a
 * use case stands on the canvas.
 */
export const flowScreen = defineScreen({
  ...appearanceDesignMetadata,
  description:
    "A use case's ordered steps around light screens, in either appearance.",
  ...artboards({
    desktop: <UseCaseFlow viewport="desktop" />,
    mobile: <UseCaseFlow viewport="mobile" />,
  }),
  slug: "flow",
  rationale:
    "Flow steps carry their own numbered tiles, connector line and links, so they prove the catalogue palette reaches content that sits on the stage rather than in a panel.",
  title: "Use-case flow",
});
