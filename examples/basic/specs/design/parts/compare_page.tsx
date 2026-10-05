import type { ReactNode } from "react";

import { PreviewWorkspace } from "../components/parts/workspace.js";

import type { AppearanceChoice } from "./appearance.js";
import { ComparisonStage } from "./compare.js";
import type { DesignDestination } from "./destinations.js";
import { DetailsPanel } from "./details.js";
import { ReviewNav, type ReviewState } from "./review.js";
import { ScreenHead, Shell, ViewSwitch, type Crumb } from "./shell.js";
import { BrowserFrame, PhoneFrame } from "./stage.js";
import type { ScreenSubject } from "./subjects.js";

export type CompareViewport = "desktop" | "mobile";

interface ComparePageProps {
  design: DesignDestination;
  subject: ScreenSubject;
  activeTitle?: string | undefined;
  /** Folder crumbs of a Changes state, text by default. */
  crumbs?: readonly Crumb[] | undefined;
  /** Draws the depicted Appearance selector holding this setting. */
  appearanceChoice?: AppearanceChoice | undefined;
  /** Secondary comparison evidence; the branch-point line alone when omitted. */
  evidence?: ReactNode;
  /** Desktop navigation column; the Changes catalogue when omitted. */
  nav?: ReactNode;
  render: (viewport: CompareViewport) => ReactNode;
  /** The compared entry's path, shown in the path chip. */
  path: string;
  mode?: "difference" | "overlay" | "side-by-side";
  state: ReviewState;
  title: string;
  viewport: CompareViewport;
}

export function ComparePage({
  design,
  activeTitle,
  appearanceChoice,
  crumbs,
  evidence,
  nav,
  subject,
  render,
  path,
  mode,
  state,
  title,
  viewport,
}: ComparePageProps) {
  return (
    <Shell
      design={design}
      appearanceChoice={appearanceChoice}
      viewport={viewport}
      nav={
        viewport === "desktop"
          ? (nav ?? <ReviewNav activeTitle={activeTitle} />)
          : null
      }
    >
      <ScreenHead
        comparisons
        action={<ViewSwitch active={viewport} />}
        comparisonMode={mode ?? "side-by-side"}
        crumbs={crumbs ?? ["Example", "Screens"]}
        path={path}
        title={title}
      />
      <PreviewWorkspace
        viewport={viewport}
        stage={false}
        inspector={
          <DetailsPanel
            subject={subject}
            comparisonEvidence={evidence ?? true}
            open
          />
        }
        render={(previewViewport) => (
          <ComparisonStage state={state} viewport={previewViewport}>
            {render(previewViewport)}
          </ComparisonStage>
        )}
      />
    </Shell>
  );
}

export function FramedShot({
  address,
  children,
  dark,
  viewport,
}: {
  address: string;
  children: ReactNode;
  dark?: boolean;
  viewport: CompareViewport;
}) {
  if (viewport === "desktop") {
    return (
      <BrowserFrame address={address} dark={dark} expandable={false}>
        {children}
      </BrowserFrame>
    );
  }
  return (
    <PhoneFrame dark={dark} small>
      {children}
    </PhoneFrame>
  );
}
