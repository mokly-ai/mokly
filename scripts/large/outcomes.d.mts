import type { ReceivedTiming, ClassificationEvidence } from "./timings.mjs";
export interface SampleInput {
  scenario: string;
  state: string;
  expectedChangedIds: readonly string[];
  expectedChangedRoutes: readonly string[];
  changedIds?: readonly string[];
  changedRoutes?: readonly string[];
  stopRequestedMs?: number;
  failurePhase?: string;
  error?: string;
}
export function sampleOutcome(
  records: readonly ReceivedTiming[],
  sample: SampleInput,
): SampleInput &
  ClassificationEvidence & {
    outcome: "ok" | "error" | "incomplete" | "membership-mismatch";
  };
