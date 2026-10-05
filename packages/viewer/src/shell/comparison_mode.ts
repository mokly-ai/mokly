/** Selected comparison mode and the contract's complete set of reset events. */

import type { ComparisonMode } from "./comparison_presentation.js";

/** Inputs that may initialize or reset one workspace's selected mode. */
export interface ComparisonModeInput {
  available: boolean;
  eligible: boolean;
  initialMode: "side" | undefined;
  ownerKey: string;
  updateVersion: number;
}

/** One owner's choice, retained while an unchanged view shows Current. */
export interface ComparisonModeState {
  initialized: boolean;
  mode: ComparisonMode;
  ownerKey: string;
  updateVersion: number;
}

/** A fresh owner starts from its eligible standalone query or Current. */
export function initialComparisonMode(
  input: ComparisonModeInput,
): ComparisonModeState {
  return {
    initialized: input.available,
    mode:
      input.available && input.eligible && input.initialMode === "side"
        ? "side"
        : "current",
    ownerKey: input.ownerKey,
    updateVersion: input.updateVersion,
  };
}

/** Only a new owner, first hydration environment, or newer update changes a choice. */
export function reconcileComparisonMode(
  state: ComparisonModeState,
  input: ComparisonModeInput,
): ComparisonModeState {
  if (state.ownerKey !== input.ownerKey) return initialComparisonMode(input);
  if (input.updateVersion > state.updateVersion)
    return {
      ...state,
      initialized: true,
      mode: "current",
      updateVersion: input.updateVersion,
    };
  if (!state.initialized && input.available)
    return initialComparisonMode(input);
  return state;
}

/** An explicit reader choice ends initial-mode adoption for this owner. */
export function selectComparisonMode(
  state: ComparisonModeState,
  mode: ComparisonMode,
): ComparisonModeState {
  return { ...state, initialized: true, mode };
}

/** An ineligible view uses Current without changing the owner's choice. */
export function effectiveComparisonMode(
  state: ComparisonModeState,
  eligible: boolean,
): ComparisonMode {
  return eligible ? state.mode : "current";
}
