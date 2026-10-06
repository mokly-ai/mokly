import assert from "node:assert/strict";
import test from "node:test";

import { fingerprintComparison } from "./helpers/fingerprint_comparison.js";
import { fingerprintRenderer } from "./helpers/fingerprint_fixture.js";
import { materialOutcome } from "./helpers/fingerprint_guard_assertions.js";
import { fingerprintRandom } from "./helpers/fingerprint_random.js";
import {
  catalogueKinds,
  fingerprintSeededCase,
} from "./helpers/fingerprint_seeded_cases.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";
import { styleSwitches } from "./helpers/style_switches.js";

const seed = 0xf19e79;
test("seeded compiled catalogues preserve text results/errors under every switch and mode", async (context) => {
  const random = fingerprintRandom(seed);
  const seen = new Set<string>();
  let comparisons = 0;
  context.diagnostic(`seed=0x${seed.toString(16)}`);
  for (let trial = 0; trial < catalogueKinds.length * 4; trial++) {
    const sample = fingerprintSeededCase(trial, random);
    seen.add(sample.kind);
    const label = `seed=0x${seed.toString(16)} trial=${trial} kind=${sample.kind}`;
    await context.test(label, async (item) => {
      const fixture = await inlineChangesFixture(item, "", "", {
        colorSchemes: false,
        ...(sample.source ? { source: sample.source } : {}),
        ...(sample.afterSource ? { afterSource: sample.afterSource } : {}),
        renderer: sample.renderer ?? {
          before: fingerprintRenderer(sample.before),
          after: fingerprintRenderer(sample.after),
        },
        files: {
          before: {
            "image.svg": '<svg width="10"/>',
            "action/image.svg": '<svg width="10"/>',
            "pane/image.svg": '<svg width="10"/>',
          },
          after: {
            "image.svg": sample.resourceChange
              ? '<svg width="20"/>'
              : '<svg width="10"/>',
            "action/image.svg": '<svg width="10"/>',
            "pane/image.svg": '<svg width="10"/>',
          },
        },
      });
      for (const mode of ["committed", "derived"] as const) {
        const input = await pageFixtureInput(fixture, mode);
        for (const switches of styleSwitches) {
          const text = await fingerprintComparison(
            input,
            false,
            "home",
            undefined,
            switches,
          );
          const actual = await fingerprintComparison(
            input,
            true,
            "home",
            undefined,
            switches,
          );
          assert.deepEqual(
            actual,
            text,
            `${label} ${mode} ${JSON.stringify(switches)}`,
          );
          comparisons++;
        }
        if (sample.guarded)
          assert.deepEqual(
            materialOutcome(input, true),
            materialOutcome(input, false),
            `${label} ${mode}: exact text bytes/references`,
          );
      }
    });
  }
  assert.deepEqual([...seen].sort(), [...catalogueKinds].sort());
  assert.equal(comparisons, 672);
});
