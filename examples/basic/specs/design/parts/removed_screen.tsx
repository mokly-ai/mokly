import type { ReactNode } from "react";

import {
  InspectorWorkspace,
  PreviewWorkspace,
} from "../components/parts/workspace.js";

import type { DesignDestination } from "./destinations.js";
import { DetailsPanel } from "./details.js";
import { reasonEvidence } from "./reason_sentences.js";
import { PreviousVersionStage } from "./removed_preview.js";
import { ReviewNav } from "./review.js";
import { ScreenHead, Shell, ViewSwitch } from "./shell.js";
import { BrowserFrame, PhoneFrame } from "./stage.js";
import type { ScreenSubject } from "./subjects.js";

/** Rendering target for a removed-screen artboard. */
type RemovedViewport = "desktop" | "mobile";

interface RemovedScreenEntry {
  design: DesignDestination;
  /** The path the screen had at the branch point. */
  path: string;
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
 * or Props action appears. The previous version's band and host hold the
 * views or the state that stands in for them, inside the preview pane.
 */
export function RemovedScreen({
  entry,
  preview,
  selection,
  state,
  subject,
  viewport,
}: RemovedScreenProps) {
  const shown = selection ?? viewport;
  const previous = {
    kind: "screen",
    path: entry.path,
    title: entry.title,
  } as const;
  const inspector = (
    <DetailsPanel
      subject={subject}
      comparisonEvidence={{ reasons: reasonEvidence(["removed"]) }}
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
        // A removed screen has no current preview to inspect.
        action={<ViewSwitch active={shown} highlight="removed" />}
        crumbs={["Example", "Screens"]}
        path={entry.path}
        status="removed"
        title={entry.title}
      />
      {state ? (
        <InspectorWorkspace inspector={inspector}>
          <PreviousVersionStage entry={previous} viewport={shown}>
            {state}
          </PreviousVersionStage>
        </InspectorWorkspace>
      ) : (
        <PreviewWorkspace
          inspector={inspector}
          viewport={shown}
          render={(previewViewport) => preview?.(previewViewport)}
          wrap={(previews) => (
            <PreviousVersionStage entry={previous} viewport={shown}>
              {previews}
            </PreviousVersionStage>
          )}
        />
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
