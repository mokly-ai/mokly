import { screen } from "@mokly/mokly";

import { PreviewWorkspace } from "../../../components/parts/workspace.js";
import { useDarkPreview } from "../../../parts/appearance.js";
import {
  DESTINATIONS,
  type DesignDestination,
} from "../../../parts/destinations.js";
import { DetailsPanel } from "../../../parts/details.js";
import { MiniDetails, MiniWelcome } from "../../../parts/mini_screens.js";
import type { ChangesStatus } from "../../../parts/nav.js";
import { AvailabilityNav } from "../../../parts/review.js";
import type { ArtboardViewport } from "../../../parts/shell.js";
import { BrowserFrame, PhoneFrame } from "../../../parts/stage.js";
import { EmptyState, FlowStep } from "../../../parts/stage_content.js";
import {
  AppearanceHead,
  AppearanceShell,
  WelcomeShot,
} from "../parts/scaffold.js";

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

function HomeAndEmpty({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <AppearanceShell design={DESTINATIONS.appearanceHome} viewport={viewport}>
      <EmptyState
        to={DESTINATIONS.appearance}
        title="Mokly"
        body="Browse the mockup catalogue: expand folders and choose an item from the navigation."
        linkLabel="Open the first screen"
      />
    </AppearanceShell>
  );
}

function ErrorAndRetry({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <AppearanceShell
      activeLabel="Welcome"
      design={DESTINATIONS.appearanceError}
      viewport={viewport}
    >
      <AppearanceHead
        idChip="example-welcome"
        preview={viewport}
        title="Welcome"
        viewport={viewport}
      />
      <PreviewWorkspace
        inspector={<DetailsPanel subject="welcome" />}
        viewport={viewport}
        render={() => (
          <EmptyState
            to={DESTINATIONS.appearanceError}
            title="This screen could not be shown"
            body="The catalogue is still available while you try again."
            linkLabel="Try again"
          />
        )}
      />
    </AppearanceShell>
  );
}

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
    <AppearanceShell
      aside={
        viewport === "mobile" ? (
          <AvailabilityNav drawer status={status} />
        ) : null
      }
      design={design}
      nav={<AvailabilityNav status={status} />}
      viewport={viewport}
    >
      <AppearanceHead
        idChip="example-welcome"
        title="Welcome"
        viewport={viewport}
      />
      <PreviewWorkspace
        inspector={<DetailsPanel subject="welcome" />}
        viewport={viewport}
        render={(previewViewport) => <WelcomeShot viewport={previewViewport} />}
      />
    </AppearanceShell>
  );
}

function UseCaseFlow({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <AppearanceShell
      activeLabel="Example tour"
      design={DESTINATIONS.appearanceFlow}
      viewport={viewport}
    >
      <AppearanceHead
        crumbs={["Example"]}
        idChip="example-tour"
        preview="none"
        title="Example tour"
        viewport={viewport}
      />
      <div className="mbk-flow">
        <div className="flow-track">
          <FlowStep
            name="arrival"
            number={1}
            title="Welcome"
            description="The tour starts on the landing screen."
            screenId={DESTINATIONS.appearance}
          >
            <FlowWelcomeShot viewport={viewport} />
          </FlowStep>
          <FlowStep
            name="detail"
            number={2}
            title="Details"
            description="The tour ends on the details screen."
            screenId={DESTINATIONS.appearanceLightOnly}
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
        </div>
      </div>
    </AppearanceShell>
  );
}

/** Appearance on the routes that carry no preview, or none yet. */
export const appearanceStatusScreens = [
  screen({
    description:
      "The catalogue home guidance with nothing selected, in either appearance.",
    desktop: <HomeAndEmpty viewport="desktop" />,
    id: "design-appearance-home",
    mobile: <HomeAndEmpty viewport="mobile" />,
    rationale:
      "Home is the first paint a reader sees, so each appearance has to be complete before any screen is chosen rather than arriving once a preview loads.",
    slug: "home",
    title: "Home and empty",
  }),
  screen({
    description:
      "The catalogue checking for changes while it stays usable, in either appearance.",
    desktop: (
      <AvailabilityScreen
        design={DESTINATIONS.appearanceLoading}
        status="pending"
        viewport="desktop"
      />
    ),
    id: "design-appearance-loading",
    mobile: (
      <AvailabilityScreen
        design={DESTINATIONS.appearanceLoading}
        status="pending"
        viewport="mobile"
      />
    ),
    rationale:
      "The spinner, the reserved count slot and the waiting message are drawn from the catalogue palette, so a loading catalogue never falls back to the other appearance's chrome around a page.",
    slug: "loading",
    title: "Catalogue loading",
  }),
  screen({
    description:
      "A screen that could not be shown, offering another attempt without leaving the catalogue.",
    desktop: <ErrorAndRetry viewport="desktop" />,
    id: "design-appearance-error",
    mobile: <ErrorAndRetry viewport="mobile" />,
    rationale:
      "Recovery states are reached by readers who are already lost, so they keep the chosen appearance, the navigation and the details panel instead of resetting to a bare page.",
    slug: "error",
    title: "Error and retry",
  }),
  screen({
    description:
      "Changes selected after the comparison could not be made, in either appearance.",
    desktop: (
      <AvailabilityScreen
        design={DESTINATIONS.appearanceUnavailable}
        status="unavailable"
        viewport="desktop"
      />
    ),
    id: "design-appearance-unavailable",
    mobile: (
      <AvailabilityScreen
        design={DESTINATIONS.appearanceUnavailable}
        status="unavailable"
        viewport="mobile"
      />
    ),
    rationale:
      "The one unavailable message and the dash in the count slot have to read as ordinary secondary text in both appearances, not as an error colour only one of them uses.",
    slug: "unavailable",
    title: "Changes unavailable",
  }),
  screen({
    description:
      "A use case's ordered steps around light screens, in either appearance.",
    desktop: <UseCaseFlow viewport="desktop" />,
    id: "design-appearance-flow",
    mobile: <UseCaseFlow viewport="mobile" />,
    rationale:
      "Flow steps carry their own numbered tiles, connector line and links, so they prove the catalogue palette reaches content that sits on the stage rather than in a panel.",
    slug: "flow",
    title: "Use-case flow",
  }),
];
