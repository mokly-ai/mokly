/**
 * The shown frames of the canvas whose rows compare, under the
 * [screen controls](../../../../docs/protocol/mokly-changes-controls.md#screen-controls):
 * a row compares when its shown views are eligible, or when a shown view that
 * reads Unmodified uses a changed component that the row's own detail names.
 * A row without a comparison keeps its current frames. A variant set offers
 * its compare while one of its shown rows compares.
 */

import type { EntryDetailV4 } from "@mokly/model";

import { detailKey } from "../catalogue/detail_fences.js";
import type { GeneratedComponentView } from "../components/views.js";
import { viewAxesKey, viewsUsingComponents } from "../review/shared_impact.js";

import type { CanvasFramePlan } from "./canvas_frames.js";
import type { ComparisonFrameDemand } from "./comparison_presentation.js";
import {
  resolveViewPresentation,
  type EntryStatus,
  type ViewState,
} from "./view_status.js";
import type { WorkspaceData } from "./workspace_data.js";

/** The facts of one row that decide whether it compares. */
interface RowFacts {
  /** The row's own eligibility and status, while its views lack evidence. */
  fallbackEligible: boolean;
  fallbackStatus: EntryStatus | undefined;
  /** The row is a removed record. */
  historical: boolean;
  /** The changed components that make the row compare where its views use them. */
  related: readonly { path: string }[];
}

/**
 * A screen's facts are the workspace's, which reads the screen's own detail;
 * a row of a variant set reads its own record and its own detail.
 */
function rowFacts(
  data: WorkspaceData,
  details: ReadonlyMap<string, EntryDetailV4>,
  path: string,
): RowFacts | undefined {
  if (data.entry.kind === "screen")
    return data.entry.path === path
      ? {
          fallbackEligible: data.comparisonEligible,
          fallbackStatus: data.status,
          historical: data.removed,
          related: data.affectedComparison ? data.relatedComponents : [],
        }
      : undefined;
  const row = data.variants.find(({ value }) => value.path === path);
  if (!row) return undefined;
  const { snapshotId } = row;
  const detail = details.get(
    detailKey({ path, ...(snapshotId === undefined ? {} : { snapshotId }) }),
  )?.workspace;
  const affected =
    row.value.changes.status === "ready" && detail?.comparisonEligible === true;
  return {
    fallbackEligible: row.comparisonEligible,
    fallbackStatus: row.status,
    historical: row.removed,
    related: affected ? detail.relatedComponents : [],
  };
}

/**
 * The views that a row's shown frames show: each frame's view, or its
 * viewport's Light view when the row has no view of the frame's scheme.
 */
function shownViews(
  views: readonly GeneratedComponentView[],
  frames: readonly CanvasFramePlan[],
): GeneratedComponentView[] {
  const shown = new Map<string, GeneratedComponentView>();
  for (const { scheme, viewport } of frames) {
    const of = (colorScheme: "dark" | "light") =>
      views.find(
        (view) =>
          view.viewport === viewport && view.colorScheme === colorScheme,
      );
    const view = of(scheme) ?? of("light");
    if (view) shown.set(viewAxesKey(view), view);
  }
  return [...shown.values()];
}

/** Whether a shown view reads Unmodified while its usage holds one of `components`. */
function affectedViewShown(
  views: readonly GeneratedComponentView[],
  states: readonly ViewState[] | undefined,
  components: readonly { path: string }[],
): boolean {
  const using = viewsUsingComponents(views, components);
  return views.some(
    (view) =>
      using.has(viewAxesKey(view)) &&
      states?.some(
        (state) =>
          state.viewport === view.viewport &&
          state.colorScheme === view.colorScheme &&
          state.comparison.kind === "unmodified",
      ) === true,
  );
}

/** Whether a row's shown frames compare, and whether the row is a removed record. */
function rowDecision(
  data: WorkspaceData,
  details: ReadonlyMap<string, EntryDetailV4>,
  path: string,
  frames: readonly CanvasFramePlan[],
): { compares: boolean; historical: boolean } {
  const facts = rowFacts(data, details, path);
  if (!facts) return { compares: false, historical: false };
  const views = shownViews(
    data.views.filter((view) => (view.variantPath ?? data.entry.path) === path),
    frames,
  );
  const states = Object.hasOwn(data.viewStates, path)
    ? data.viewStates[path]
    : undefined;
  const { comparisonEligible } = resolveViewPresentation({
    displayedViews: views,
    fallbackComparisonEligible: facts.fallbackEligible,
    fallbackStatus: facts.fallbackStatus,
    states,
  });
  return {
    compares:
      comparisonEligible || affectedViewShown(views, states, facts.related),
    historical: facts.historical,
  };
}

/**
 * The shown frames whose rows compare, in canvas order. `details` are the
 * catalogue's held details, by `detailKey`. For the routed row the decision
 * agrees with the routed view's eligibility for the same shown views.
 */
export function comparisonFrames(
  data: WorkspaceData,
  details: ReadonlyMap<string, EntryDetailV4>,
  frames: readonly CanvasFramePlan[],
): ComparisonFrameDemand[] {
  const shown = frames.filter((frame) => !frame.hidden);
  const byRow = new Map<string, CanvasFramePlan[]>();
  for (const frame of shown) {
    const row = byRow.get(frame.entry.path);
    if (row) row.push(frame);
    else byRow.set(frame.entry.path, [frame]);
  }
  const decisions = new Map(
    [...byRow].map(([path, own]) => [
      path,
      rowDecision(data, details, path, own),
    ]),
  );
  return shown.flatMap(({ entry, key, scheme, viewport }) => {
    const decision = decisions.get(entry.path);
    return decision?.compares
      ? [
          {
            entry: { path: entry.path },
            key,
            scheme,
            viewport,
            ...(decision.historical ? { historical: true } : {}),
          },
        ]
      : [];
  });
}

/**
 * Whether a workspace offers its compare modes, and with them its Changes
 * tab. A variant set with live frames offers them while one of its shown
 * rows compares, whichever row the route names. A screen, and a removed
 * component or variant, which has no live frames, follow the eligibility of
 * the routed entry's shown views.
 */
export function comparisonOffered({
  comparisons,
  frames,
  routedEligible,
  set,
}: {
  /** Whether the catalogue has comparisons. */
  comparisons: boolean;
  /** The shown frames whose rows compare; none for a removed entry. */
  frames: readonly ComparisonFrameDemand[] | undefined;
  /** Whether the routed entry's shown views are comparison-eligible. */
  routedEligible: boolean;
  /** Whether the canvas holds a variant set. */
  set: boolean;
}): boolean {
  if (!comparisons) return false;
  return set && frames ? frames.length > 0 : routedEligible;
}
