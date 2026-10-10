import assert from "node:assert/strict";

import { classifyComponents } from "../../dist/review/component_classification.js";
import type { ComponentClassificationInput } from "../../dist/review/component_classification_input.js";
import { LightningCssRuleParser } from "../../dist/review/css/rules.js";

export async function compareCacheBounds(input: ComponentClassificationInput) {
  const classify = async (cssCacheBytes?: number) => {
    const native = new LightningCssRuleParser();
    let calls = 0;
    const result = await classifyComponents({
      ...input,
      useFastPath: false,
      useStylePath: false,
      ...(cssCacheBytes === undefined ? {} : { cssCacheBytes }),
      cssParser: {
        parse(source) {
          calls++;
          return native.parse(source);
        },
      },
    });
    return { result, calls };
  };
  const uncached = await classify(0);
  const bounded = await classify();
  assert.deepEqual(bounded.result, uncached.result);
  assert.ok(
    uncached.calls > bounded.calls,
    "the test must exercise cache hits",
  );
  return bounded.result;
}
