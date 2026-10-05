/** Static/Live selection state and the pure decisions built on top of it. */

import type { ViewerInteractiveDescriptor } from "../client/interactive_capability.js";

import type { ShellState } from "./store_state.js";
import type { WorkspaceData } from "./workspace_data.js";
import type { WorkspaceVariantSelection } from "./workspace_selection.js";

/** How the current screen fragment or saved variant is previewed. */
export type PreviewMode = "live" | "static";

/**
 * What the private evidence adopted for the routed entry says about Live:
 * `pending` until that route's workspace is adopted, `eligible` only for an
 * explicit `true`, and `ineligible` for an opt-out or an unknown value.
 */
export type LiveEligibility = "eligible" | "ineligible" | "pending";

/**
 * Toolbar presentation for one routed view: `none` renders no control at all,
 * `pending` keeps the control the previous view showed while this view's
 * eligibility loads, and `unavailable` keeps Static selected with Live
 * disabled. Only `available` may prepare or mount Live.
 */
export type LivePreviewAvailability =
  "available" | "none" | "pending" | "unavailable";

/** A current screen or saved component variant that can offer Live. */
export interface LivePreviewView {
  entryPath: string;
  variantPath?: string;
}

/** Product copy shared by the toolbar, the stage and the inspector. */
export const LIVE_PREVIEW_COPY = {
  highlight: "Highlighting works in Static.",
  liveTitle: "Interact with the live preview",
  notice: "Switch to Static to inspect or edit this view.",
  preparing: "Getting the live preview ready",
  staticTitle: "Show the static preview",
  unavailable: "Live preview is unavailable for this view.",
} as const;

/** Validate a stored or recovered preview mode. */
export function isPreviewMode(value: unknown): value is PreviewMode {
  return value === "live" || value === "static";
}

/** The Live-capable view shown by a workspace, if its preview is current. */
export function livePreviewView(
  data: WorkspaceData,
  selection: WorkspaceVariantSelection,
): LivePreviewView | undefined {
  if (data.removed) return;
  if (data.entry.kind === "screen") return { entryPath: data.entry.path };
  const variant = selection.variant;
  return variant && !variant.removed
    ? { entryPath: data.entry.path, variantPath: variant.value.path }
    : undefined;
}

/** Key recorded when one generation cannot prepare Live previews at all. */
export function liveGenerationKey(generation: string): string {
  return JSON.stringify([generation]);
}

/** Key recorded when one view's Live frame could not be mounted. */
export function liveViewKey(generation: string, view: LivePreviewView): string {
  return JSON.stringify([generation, view.entryPath, view.variantPath ?? null]);
}

/**
 * Read eligibility only from the private workspace adopted for this exact
 * entry. Without one, the view stays `pending` while its route
 * evidence is still expected and is `ineligible` once that request settled.
 */
export function liveEligibility(input: {
  entry: WorkspaceData["entry"];
  pending: boolean;
  workspace: WorkspaceData | undefined;
}): LiveEligibility {
  const { entry, workspace } = input;
  if (
    workspace?.entry.path === entry.path &&
    workspace.entry.kind === entry.kind
  )
    return workspace.interactive === true ? "eligible" : "ineligible";
  return input.pending ? "pending" : "ineligible";
}

/**
 * Decide whether the toolbar shows Static/Live and whether Live is usable.
 * A pending view keeps the presence the previous view displayed, so known
 * eligibility changes the toolbar at most once and never flickers it.
 */
export function livePreviewAvailability(input: {
  descriptor: ViewerInteractiveDescriptor | undefined;
  eligibility: LiveEligibility;
  /** The previously displayed routed view offered Static/Live. */
  retained: boolean;
  unavailable: readonly string[];
  view: LivePreviewView | undefined;
}): LivePreviewAvailability {
  const { descriptor, eligibility, view } = input;
  if (!descriptor || !view || eligibility === "ineligible") return "none";
  if (eligibility === "pending" && !input.retained) return "none";
  const failed =
    descriptor.state === "failed" ||
    input.unavailable.includes(liveGenerationKey(descriptor.generation)) ||
    input.unavailable.includes(liveViewKey(descriptor.generation, view));
  if (failed) return "unavailable";
  return eligibility === "pending" ? "pending" : "available";
}

/** Select a preview mode that later views in this document keep. */
export function withPreviewMode(
  state: ShellState,
  mode: PreviewMode,
): ShellState {
  return state.previewMode === mode ? state : { ...state, previewMode: mode };
}

/** Return to Static and keep Live disabled wherever it failed. */
export function withLiveUnavailable(
  state: ShellState,
  key: string,
): ShellState {
  if (state.previewMode === "static" && state.liveUnavailable.includes(key))
    return state;
  return {
    ...state,
    liveUnavailable: state.liveUnavailable.includes(key)
      ? state.liveUnavailable
      : [...state.liveUnavailable, key],
    previewMode: "static",
  };
}
