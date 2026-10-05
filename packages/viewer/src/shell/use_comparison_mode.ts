/** React adoption of one comparison owner's retained mode choice. */

import { useEffect, useReducer } from "react";

import {
  effectiveComparisonMode,
  initialComparisonMode,
  reconcileComparisonMode,
  selectComparisonMode,
  type ComparisonModeInput,
  type ComparisonModeState,
} from "./comparison_mode.js";
import type { ComparisonMode } from "./comparison_presentation.js";

/** Apply resets immediately while committing their state after the render. */
export function useComparisonMode(input: ComparisonModeInput): {
  mode: ComparisonMode;
  selectMode(mode: ComparisonMode): void;
} {
  const [state, setState] = useReducer(
    (_previous: ComparisonModeState, next: ComparisonModeState) => next,
    input,
    initialComparisonMode,
  );
  const current = reconcileComparisonMode(state, input);
  useEffect(() => {
    if (current !== state) setState(current);
  }, [current, state]);
  return {
    mode: effectiveComparisonMode(current, input.eligible),
    selectMode: (mode) => setState(selectComparisonMode(current, mode)),
  };
}
