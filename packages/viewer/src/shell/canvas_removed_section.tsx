/**
 * The parts that a removed entry's sections and states share: the section
 * whose head holds the entry's title, its path, the Removed status and the
 * quiet label `Showing previous version`, and the canvas that holds a state
 * in place of the section, so it shows no zoom pill.
 */

import type { ReactNode } from "react";

import type { CanvasSectionFrame } from "@mokly/ui/canvas-section";
import { CanvasState } from "@mokly/ui/canvas-state";

import type { ViewerSelection } from "../host/types.js";
import { PREVIOUS_VERSION } from "../previews/copy.js";
import type { SnapshotPresentation } from "../previews/presentation.js";

import { CanvasEntryStage } from "./canvas_stage.js";
import { PreviewUnavailable } from "./preview_unavailable.js";
import type { RemovedPreviewData } from "./previews.js";

/** What the section of a removed entry shows. */
export interface RemovedSectionProps {
  colorScheme: ViewerSelection["colorScheme"];
  data: RemovedPreviewData;
  presentations: ReadonlyMap<string, SnapshotPresentation>;
  retry(): void;
}

/** The canvas while it holds a state in place of the section. */
export function RemovedHolding({ children }: { children: ReactNode }) {
  return <CanvasState routed>{children}</CanvasState>;
}

/** The unavailable state in place of the section, with Retry when given. */
export function RemovedUnavailable({
  retry,
}: {
  retry: (() => void) | undefined;
}) {
  return (
    <RemovedHolding>
      <PreviewUnavailable retry={retry} />
    </RemovedHolding>
  );
}

/**
 * The section of a removed entry's historical views. A document without a
 * historical dark version keeps its light version under Dark, and the head's
 * quiet label then says so.
 */
export function RemovedSection({
  colorScheme,
  data,
  fitKey,
  frames,
  kind,
}: {
  colorScheme: ViewerSelection["colorScheme"];
  data: RemovedPreviewData;
  fitKey: string;
  frames: readonly CanvasSectionFrame[];
  kind: "document" | "screen";
}) {
  return (
    <CanvasEntryStage
      fitKey={fitKey}
      frames={frames}
      kind={kind}
      path={data.path}
      quietLabel={
        data.lightOnly && colorScheme === "dark"
          ? PREVIOUS_VERSION.lightOnlyLabel
          : PREVIOUS_VERSION.label
      }
      status="Removed"
      title={data.title}
    />
  );
}
