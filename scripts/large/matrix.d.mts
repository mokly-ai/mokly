import type { SampleInput } from "./outcomes.mjs";
import type { ClassificationScenario } from "./scenarios.mjs";
import type { ClassificationEvidence } from "./timings.mjs";
export type MatrixSample = SampleInput &
  ClassificationEvidence & {
    outcome: "ok" | "error" | "incomplete" | "membership-mismatch";
  };
export function executeMatrix(
  definitions: readonly ClassificationScenario[],
  operations: {
    prepare(scenario: ClassificationScenario): Promise<void>;
    sample(
      scenario: ClassificationScenario,
      state: string,
    ): Promise<MatrixSample>;
    close(): Promise<void> | undefined;
    restore(): Promise<void>;
  },
  identity?: Record<string, unknown>,
): Promise<{ runs: MatrixSample[]; restorationError?: string }>;
