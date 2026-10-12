import assert from "node:assert/strict";

import type { FastPathFixture } from "./component_fast_path.js";
import {
  fingerprintComparison,
  fingerprintMaterials,
} from "./fingerprint_comparison.js";
import { styleSwitches } from "./style_switches.js";

export function materialOutcome(input: FastPathFixture, enabled: boolean) {
  try {
    const result = fingerprintMaterials(input, enabled);
    return {
      kind: "result" as const,
      projected: result.projected,
      references: result.references,
    };
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return { kind: "error" as const, name: error.name, message: error.message };
  }
}

export async function assertGuardedMaterials(
  input: FastPathFixture,
  label: string,
) {
  const actual = [];
  const expected = [];
  for (const switches of styleSwitches) {
    const text = await fingerprintComparison(
      input,
      false,
      "home",
      undefined,
      switches,
    );
    const current = await fingerprintComparison(
      input,
      true,
      "home",
      undefined,
      switches,
    );
    actual.push({ switches, outcome: current });
    expected.push({ switches, outcome: text });
  }
  assert.deepEqual(actual, expected, `${label}: all four switch settings`);
  assert.deepEqual(
    materialOutcome(input, true),
    materialOutcome(input, false),
    `${label}: exact text materials/references`,
  );
}
