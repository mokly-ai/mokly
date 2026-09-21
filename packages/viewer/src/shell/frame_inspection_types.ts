/** Shared ownership types for registry-backed frame inspection. */

import type { ShellFrameSession } from "./frame_registry.js";

export type ShellInspectionKind = "highlight" | "pick" | "workspace";

export interface ShellInspectionClaim {
  readonly id: number;
  readonly kind: ShellInspectionKind;
}

export interface ShellInspectionSnapshot {
  readonly revision: number;
  readonly active?: ShellInspectionClaim;
}

/** Highlight ownership and exact sessions retained for label geometry. */
export interface ShellHighlightActivation {
  readonly claim: ShellInspectionClaim;
  readonly sessions: readonly ShellFrameSession[];
}
