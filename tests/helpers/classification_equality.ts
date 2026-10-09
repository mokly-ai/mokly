import assert from "node:assert/strict";

import type { ComponentClassificationWithSources } from "../../dist/review/component_classification_sources.js";
import type { DependencyAnalysis } from "../../packages/viewer/dist/review/types.js";

/** Compare public evidence and sources, then cross-check each frozen proof. */
export function assertClassificationEqual(
  actual: ComponentClassificationWithSources,
  expected: ComponentClassificationWithSources,
): void {
  const { cssProof: left, ...leftSources } = actual.sources;
  const { cssProof: right, ...rightSources } = expected.sources;
  assert.deepEqual(
    { ...actual, sources: leftSources },
    { ...expected, sources: rightSources },
  );
  assert.equal(Boolean(left), Boolean(right));
  for (const result of [actual.result, expected.result]) {
    const visit = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      if ("analysis" in value) {
        left?.validate(value.analysis as DependencyAnalysis);
        right?.validate(value.analysis as DependencyAnalysis);
      }
      for (const item of Object.values(value)) visit(item);
    };
    visit(result);
  }
}
