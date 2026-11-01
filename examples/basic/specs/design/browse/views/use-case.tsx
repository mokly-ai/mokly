import { defineScreen } from "@mokly/mokly";

import { FlowStage } from "../../../../../../packages/ui/src/flow-step/flow-step.js";
import { designMetadata } from "../../metadata.js";
import { artboards } from "../../parts/artboards.js";
import { DESTINATIONS } from "../../parts/destinations.js";
import { ENTRY_PATHS, EXAMPLE_CRUMB } from "../../parts/entry_paths.js";
import { MiniDetails, MiniWelcome } from "../../parts/mini_screens.js";
import { NavTree } from "../../parts/nav.js";
import { ScreenHead, Shell } from "../../parts/shell.js";
import { BrowserFrame, PhoneFrame } from "../../parts/stage.js";
import { FlowStep } from "../../parts/stage_content.js";

function UseCaseSteps({ viewport }: { viewport: "desktop" | "mobile" }) {
  return (
    <FlowStage>
      <FlowStep
        name="arrival"
        number={1}
        title="Welcome"
        screenTitle="Welcome"
        description="The tour starts on the landing screen."
        screenPath={DESTINATIONS.welcome}
      >
        {viewport === "desktop" ? (
          <BrowserFrame address="example.test/welcome">
            <MiniWelcome />
          </BrowserFrame>
        ) : (
          <PhoneFrame small>
            <MiniWelcome compact />
          </PhoneFrame>
        )}
      </FlowStep>
      <FlowStep
        name="detail"
        number={2}
        title="Details"
        screenTitle="Details"
        description="The tour ends on the details screen."
        screenPath={DESTINATIONS.details}
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
  );
}

function UseCaseHead() {
  return (
    <ScreenHead
      comparisons={false}
      crumbs={[EXAMPLE_CRUMB]}
      path={ENTRY_PATHS.tour}
      title="Example tour"
    />
  );
}

function UseCaseDesktop() {
  return (
    <Shell
      design={DESTINATIONS.tour}
      viewport="desktop"
      nav={<NavTree activeLabel="Example tour" />}
    >
      <UseCaseHead />
      <UseCaseSteps viewport="desktop" />
    </Shell>
  );
}

function UseCaseMobile() {
  return (
    <Shell design={DESTINATIONS.tour} viewport="mobile" nav={null}>
      <UseCaseHead />
      <UseCaseSteps viewport="mobile" />
    </Shell>
  );
}

export const useCaseScreen = defineScreen({
  ...designMetadata,
  colorSchemes: ["light"],
  description:
    "A selected use case rendering ordered steps of existing screens.",
  ...artboards({ desktop: <UseCaseDesktop />, mobile: <UseCaseMobile /> }),
  slug: "use-case",
  title: "Selected use case",
});
