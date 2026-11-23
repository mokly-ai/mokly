/**
 * The compare of a screen's or a component's workspace on its canvas: the
 * frames that compare, the frame that Side by side compares, the outcome
 * line of each compared frame for the comparison band, and the comparison
 * controller with the setter of the compared frame.
 */

import { useMemo } from "react";

import type { ChangeStatusValue } from "@mokly/ui/change-status";

import type { CanvasFramePlan } from "./canvas_frames.js";
import type { StandaloneComparisonHead } from "./comparison_canvas.js";
import {
  comparedFrameKey,
  useComparedFrameChoice,
  type CanvasComparisonController,
} from "./comparison_compared_frame.js";
import { comparedFrameOutcome } from "./comparison_outcome.js";
import {
  comparedRows,
  comparisonFramePlans,
  removedComparisonPlans,
  type ComparisonFramePlan,
} from "./comparison_rows.js";
import { comparedFrames, type ComparedFrame } from "./comparison_selection.js";
import { useShellStore } from "./store_context.js";
import type { ComparisonController } from "./use_comparison.js";
import type { WorkspaceData, WorkspaceVariant } from "./workspace_data.js";

/** What the canvas, the band and the panel read of a workspace's compare. */
export interface WorkspaceComparison {
  /** The props of `ComparisonCanvas`, less its children. */
  canvas: {
    comparison: ComparisonController;
    entryId: string;
    entryKind: WorkspaceData["entry"]["kind"];
    frames: readonly ComparedFrame[];
    plans: ReadonlyMap<string, ComparisonFramePlan>;
    sideKey: string | undefined;
    standalone?: StandaloneComparisonHead;
  };
  controller: CanvasComparisonController;
  /** The outcome line of each compared frame, once the comparison is loaded. */
  outcomes: readonly string[];
}

export function useWorkspaceComparison({
  comparison,
  data,
  frames,
  head,
  status,
  usingChanged,
  variant,
}: {
  comparison: ComparisonController;
  data: WorkspaceData;
  /** The workspace's frames on the canvas, from which the shown ones compare. */
  frames: readonly CanvasFramePlan[];
  head: { path: string; title: string };
  status: ChangeStatusValue | undefined;
  /** The axes keys of the routed views that use a changed component. */
  usingChanged: ReadonlySet<string> | undefined;
  variant: WorkspaceVariant | undefined;
}): WorkspaceComparison {
  const choice = useComparedFrameChoice();
  const shown = useShellStore().state.frames;
  const entry = variant?.value ?? data.entry;
  const routed = entry.path;
  // A removed component or variant has no live frames: its compare draws
  // the frames of its own views alone, of the schemes that the Frames
  // filter shows.
  const removed = data.removed || variant?.removed === true;
  const plans = useMemo(
    () =>
      removed
        ? removedComparisonPlans(data.compared, entry, shown)
        : comparisonFramePlans(frames),
    [data.compared, entry, frames, removed, shown],
  );
  const byKey = useMemo(
    () => new Map(plans.map((plan) => [plan.key, plan])),
    [plans],
  );
  const rows = useMemo(
    () => comparedRows(data, routed, usingChanged),
    [data, routed, usingChanged],
  );
  const generations = comparison.generations;
  const compared = useMemo(
    () => (generations ? comparedFrames(plans, generations, rows) : []),
    [generations, plans, rows],
  );
  const sideKey = comparedFrameKey(compared, choice.chosen);
  const component = data.entry.kind === "component";
  return {
    canvas: {
      comparison,
      entryId: routed,
      entryKind: data.entry.kind,
      frames: compared,
      plans: byKey,
      sideKey,
      ...(removed
        ? {
            standalone: {
              kind: "component",
              path: head.path,
              status,
              title: head.title,
            },
          }
        : {}),
    },
    controller: {
      ...comparison,
      comparedFrame: sideKey,
      setComparedFrame: choice.setComparedFrame,
    },
    outcomes: comparison.presentation
      ? compared.map((frame) =>
          comparedFrameOutcome(
            frame,
            byKey.get(frame.key)?.name ?? frame.key,
            component,
          ),
        )
      : [],
  };
}
