import type { ReactNode } from "react";

import {
  InspectorWorkspace,
  PreviewWorkspace,
} from "../components/parts/workspace.js";

import type { DesignDestination } from "./destinations.js";
import { DetailsPanel } from "./details.js";
import { PreviousVersionLabel } from "./removed_preview.js";
import { ReviewNav } from "./review.js";
import { ScreenHead, Shell, ViewSwitch } from "./shell.js";
import { BrowserFrame, PhoneFrame, Stage } from "./stage.js";
import type { ScreenSubject } from "./subjects.js";

/** Rendering target for a removed-screen artboard. */
type RemovedViewport = "desktop" | "mobile";

interface RemovedScreenEntry {
  design: DesignDestination;
  id: string;
  title: string;
}

interface RemovedScreenProps {
  entry: RemovedScreenEntry;
  /** The previous mobile and desktop views, one per preview viewport. */
  preview?: (viewport: RemovedViewport) => ReactNode;
  /** Viewport the preview control holds; the artboard's own size by default. */
  selection?: RemovedViewport | "both";
  /** A stage that replaces the previous views until they can be shown. */
  state?: ReactNode;
  subject: ScreenSubject;
  viewport: RemovedViewport;
}

/**
 * A removed screen opens the previous version of its mobile and desktop views.
 * The heading keeps its Removed badge, Light is the only scheme those views
 * were rendered in, and no comparison band, Current selector, refresh control
 * or Props action appears.
 */
export function RemovedScreen({
  entry,
  preview,
  selection,
  state,
  subject,
  viewport,
}: RemovedScreenProps) {
  const inspector = (
    <DetailsPanel
      subject={subject}
      comparisonEvidence={<p>The previous version comes from that point.</p>}
      open
    />
  );
  return (
    <Shell
      design={entry.design}
      viewport={viewport}
      nav={
        viewport === "desktop" ? (
          <ReviewNav activeDestination={entry.design} />
        ) : null
      }
    >
      <ScreenHead
        action={<ViewSwitch active={selection ?? viewport} />}
        crumbs={["Example", "Screens"]}
        idChip={entry.id}
        status="removed"
        title={entry.title}
      />
      {state ? (
        <InspectorWorkspace inspector={inspector}>
          <Stage>{state}</Stage>
        </InspectorWorkspace>
      ) : (
        <>
          <PreviousVersionLabel />
          <PreviewWorkspace
            inspector={inspector}
            viewport={selection ?? viewport}
            render={(previewViewport) => preview?.(previewViewport)}
          />
        </>
      )}
    </Shell>
  );
}

/** One previous view of a removed screen in its historical device chrome. */
export function RemovedView({
  address,
  children,
  compact,
  viewport,
}: {
  address: string;
  children: ReactNode;
  compact: boolean;
  viewport: RemovedViewport;
}) {
  return viewport === "mobile" ? (
    <PhoneFrame label="Mobile" small={compact}>
      {children}
    </PhoneFrame>
  ) : (
    <BrowserFrame address={address} label="Desktop">
      {children}
    </BrowserFrame>
  );
}
