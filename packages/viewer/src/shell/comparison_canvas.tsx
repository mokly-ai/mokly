/**
 * The compare on the canvas of a screen's or a component's workspace. While a
 * compare mode shows, each compared frame of the canvas draws its versions in
 * the shown mode, or its own row's failure. While the comparison or its
 * documents load, or after every drawn row failed, the canvas holds that
 * state in place of its section.
 * With `shown` false the canvas shows its live frames, while the mode, the
 * loaded comparison and its presentations stay, so a later `shown` shows the
 * mode again without a new request. This container reads the comparison
 * controller and its documents; `@mokly/ui/canvas-comparison` draws the
 * stage and its state.
 */

import { useMemo, useRef } from "react";
import type { ReactNode } from "react";

import { CanvasComparisonStage } from "@mokly/ui/canvas-comparison";
import type { CanvasSectionKind } from "@mokly/ui/canvas-section";
import type { ChangeStatusValue } from "@mokly/ui/change-status";
import { ComparisonFailure } from "@mokly/ui/comparison-stage";

import type { ViewRouteKind } from "../navigation/routes.js";

import { CanvasEntryStage } from "./canvas_stage.js";
import {
  CanvasComparisonContext,
  type CanvasComparison,
} from "./comparison_canvas_context.js";
import {
  useComparedSizes,
  useComparisonSyncs,
  useSwipeSplit,
} from "./comparison_canvas_parts.js";
import {
  canvasCompareState,
  shownComparedFrames,
  shownCompareMode,
} from "./comparison_canvas_state.js";
import {
  comparisonSectionFrames,
  type ComparedFrameState,
  type ComparisonSectionInput,
} from "./comparison_cells.js";
import type { ComparisonFramePlan } from "./comparison_rows.js";
import {
  comparedRowDocuments,
  type ComparedFrame,
} from "./comparison_selection.js";
import { entryWording } from "./entry_wording.js";
import { focusThen } from "./retry_focus.js";
import type { ComparisonController } from "./use_comparison.js";
import {
  useComparisonDocuments,
  type ComparisonRowsState,
} from "./use_comparison_documents.js";
import { useScrollTogether } from "./use_scroll_together.js";

/** The section head of an entry without live frames, such as a removed variant. */
export interface StandaloneComparisonHead {
  kind: CanvasSectionKind;
  path: string;
  status?: ChangeStatusValue | undefined;
  title: string;
}

/** An entry without live frames gives its compare's stage none. */
const NO_FRAMES = [] as const;

/** While a state covers the canvas, the section keeps its live frames. */
const COVERED: CanvasComparison = {
  covered: true,
  fitKey: (live) => live,
  frames: (live) => live,
};

/** A compared frame's versions from its row's presented documents. */
function frameState(
  frame: ComparedFrame,
  rows: ComparisonRowsState,
): ComparedFrameState {
  const row = rows.get(frame.entry);
  if (row?.status === "failed")
    return { message: row.message, status: "failed" };
  const presentations = row?.status === "ready" ? row.presentations : undefined;
  const pane = (side: "after" | "before") => {
    const address = frame.documents[side];
    const presentation = address ? presentations?.get(address) : undefined;
    const name = side === "before" ? "Before" : "Current";
    // A Light view that stands in for a missing Dark view names its Dark
    // frame, so no two frames' panes share one title.
    const scheme = frame.lightOnly
      ? "dark · Light only"
      : frame.view.colorScheme;
    return presentation
      ? {
          [side]: {
            presentation,
            side,
            title: `${name} — ${frame.view.viewport} — ${scheme}`,
          },
        }
      : {};
  };
  return { status: "ready", ...pane("before"), ...pane("after") };
}

export function ComparisonCanvas({
  children,
  comparison,
  entryId,
  entryKind,
  frames,
  plans,
  shown = true,
  sideKey,
  standalone,
}: {
  /** The live canvas of the workspace, or the state of an entry without one. */
  children: ReactNode;
  comparison: ComparisonController;
  entryId: string;
  entryKind: ViewRouteKind;
  /** The frames that compare, in the canvas's order. */
  frames: readonly ComparedFrame[];
  /** The frames that the compare can draw, by their keys. */
  plans: ReadonlyMap<string, ComparisonFramePlan>;
  /** Whether the canvas shows the compare mode, as it does by default. */
  shown?: boolean;
  /** The frame that Side by side compares, by its key. */
  sideKey: string | undefined;
  /** The section head of an entry without live frames, which the compare draws alone. */
  standalone?: StandaloneComparisonHead | undefined;
}) {
  const together = useScrollTogether();
  const active = shown && comparison.mode !== "current";
  const presented = comparison.presentation?.mode;
  const mode =
    presented === undefined ? undefined : shownCompareMode(presented, frames);
  const drawn =
    mode === undefined ? [] : shownComparedFrames(frames, mode, sideKey);
  const rows = useComparisonDocuments(
    active && presented !== undefined ? comparison.generations : undefined,
    comparedRowDocuments(drawn),
  );
  const state = canvasCompareState({
    frames: drawn,
    generations: comparison.generations,
    mode,
    rows,
  });
  const sync = useComparisonSyncs(together.on);
  const [split, setSplit] = useSwipeSplit(mode);
  const sizes = useComparedSizes();
  // The stage holds the state and then the frames, so Try again focuses it.
  const stage = useRef<HTMLDivElement>(null);
  const component = entryKind === "component";
  const wording = entryWording(component ? "component" : "screen");
  const ready = active && state.status === "ready" ? state : undefined;
  const input = useMemo<ComparisonSectionInput | undefined>(() => {
    if (!ready) return undefined;
    return {
      frames: drawn.flatMap((frame) => {
        const plan = plans.get(frame.key);
        if (!plan) return [];
        const cell = {
          column: plan.column,
          kind: plan.kind,
          label: plan.label,
          name: plan.name,
          row: plan.row,
          scheme: plan.scheme,
          size: sizes.size(frame, plan.kind),
          ...(plan.kind === "component"
            ? { onMeasure: sizes.measure(frame) }
            : {}),
        };
        return [{ cell, frame, state: frameState(frame, rows) }];
      }),
      mode: ready.mode,
      onSplit: setSplit,
      // The row's load replaces its Try again, so the stage takes focus first.
      retry: (entry) => {
        stage.current?.focus();
        comparison.retry(entry);
      },
      sideKey,
      split,
      sync,
      wording,
    };
  }, [
    comparison.retry,
    drawn,
    plans,
    ready,
    rows,
    setSplit,
    sideKey,
    sizes,
    split,
    sync,
    wording,
  ]);
  const section = useMemo<CanvasComparison | undefined>(() => {
    if (!active) return undefined;
    if (!input) return COVERED;
    return {
      covered: false,
      fitKey: (live) =>
        input.mode === "side" ? `${live}:side:${input.sideKey ?? ""}` : live,
      frames: (live) => comparisonSectionFrames(input, live),
    };
  }, [active, input]);
  // Every drawn row failed, so Try again requests every row again.
  const retry = focusThen(stage, comparison.refresh);
  const stateNode = !active ? undefined : state.status === "loading" ? (
    "Loading comparison…"
  ) : state.status === "failed" ? (
    <ComparisonFailure details={state.message} onRetry={retry} />
  ) : state.status === "unavailable" ? (
    wording.label("This screen has no comparison available.")
  ) : undefined;
  return (
    <CanvasComparisonStage
      active={active}
      busy={active && (comparison.busy || state.status === "loading")}
      component={component}
      entryId={entryId}
      ref={stage}
      state={stateNode}
    >
      <CanvasComparisonContext value={section}>
        {standalone && input ? (
          // The stage reads the compare's frames from the context.
          <CanvasEntryStage
            fitKey={`compare:${entryId}`}
            frames={NO_FRAMES}
            kind={standalone.kind}
            path={standalone.path}
            status={standalone.status}
            title={standalone.title}
          />
        ) : (
          children
        )}
      </CanvasComparisonContext>
    </CanvasComparisonStage>
  );
}
