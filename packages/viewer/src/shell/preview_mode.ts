/** Static/Live selection state and the pure decisions built on top of it. */

import type { ViewerInteractiveDescriptor } from "../client/interactive_capability.js";

import type { ShellState } from "./store_state.js";
import type { WorkspaceData } from "./workspace_data.js";
import type { WorkspaceVariantSelection } from "./workspace_selection.js";

/** How the current screen fragment or saved variant is previewed. */
export type PreviewMode = "live" | "static";

/**
 * Toolbar presentation for one routed view: `none` renders no control at all,
 * `unavailable` keeps Static selected with Live disabled.
 */
export type LivePreviewAvailability = "available" | "none" | "unavailable";

/** A current screen or saved component variant that can offer Live. */
export interface LivePreviewView {
  entryId: string;
  variantId?: string;
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
  if (data.removed || selection.error) return;
  if (data.entry.kind === "screen") return { entryId: data.entry.id };
  const variant = selection.variant;
  return variant && !variant.removed
    ? { entryId: data.entry.id, variantId: variant.value.id }
    : undefined;
}

/** Key recorded when one generation cannot prepare Live previews at all. */
export function liveGenerationKey(generation: string): string {
  return JSON.stringify([generation]);
}

/** Key recorded when one view's Live frame could not be mounted. */
export function liveViewKey(generation: string, view: LivePreviewView): string {
  return JSON.stringify([generation, view.entryId, view.variantId ?? null]);
}

/** Decide whether the toolbar shows Static/Live and whether Live is usable. */
export function livePreviewAvailability(input: {
  descriptor: ViewerInteractiveDescriptor | undefined;
  unavailable: readonly string[];
  view: LivePreviewView | undefined;
}): LivePreviewAvailability {
  const { descriptor, view } = input;
  if (!descriptor || !view) return "none";
  const failed =
    descriptor.state === "failed" ||
    input.unavailable.includes(liveGenerationKey(descriptor.generation)) ||
    input.unavailable.includes(liveViewKey(descriptor.generation, view));
  return failed ? "unavailable" : "available";
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
