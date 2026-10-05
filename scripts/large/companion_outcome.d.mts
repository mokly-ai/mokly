import type { SampleInput } from "./outcomes.mjs";
import type { ReceivedTiming } from "./timings.mjs";
export function companionOutcome(
  records: readonly ReceivedTiming[],
  sample: Omit<SampleInput, "state"> & Record<string, unknown>,
): {
  kind: "material-work-companion";
  timed: false;
  scenario: string;
  templateDigest?: string;
  fixtureCommit?: string;
  materialWork?: Readonly<Record<string, number>>;
  outcome: "ok" | "error" | "incomplete" | "membership-mismatch";
};
