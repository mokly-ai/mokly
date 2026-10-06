import assert from "node:assert/strict";
import test from "node:test";

import {
  comparisonMaterials,
  fingerprintMaterials,
} from "./helpers/fingerprint_comparison.js";
import {
  inlineChangesFixture,
  inlineRenderer,
} from "./helpers/inline_changes.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";
import {
  compareStyleSwitches,
  styleSwitches,
} from "./helpers/style_switches.js";

for (const tag of ["svg", "math"])
  test(`open ${tag} at EOF preserves full-document URL normalization`, async (t) => {
    const renderer = (url: string) =>
      inlineRenderer(
        `<style>.entry{background:&#117rl(${url})}</style>`,
      ).replace("</body></html>", `</body></html><${tag}>`);
    const fixture = await inlineChangesFixture(t, "", "", {
      colorSchemes: false,
      renderer: {
        before: renderer("../asset.svg"),
        after: renderer(".././asset.svg"),
      },
    });
    for (const mode of ["committed", "derived"] as const) {
      const input = await pageFixtureInput(fixture, mode);
      const oracle = await compareStyleSwitches(input, styleSwitches[0], false);
      assert.equal(oracle.view.state, "unchanged");
      for (const switches of styleSwitches) {
        await t.test(`${mode}/${JSON.stringify(switches)}`, async () => {
          const result = await compareStyleSwitches(input, switches);
          assert.deepEqual(result, oracle);
        });
      }
      await t.test(`${mode}/material bytes`, () => {
        assert.deepEqual(
          comparisonMaterials(fingerprintMaterials(input)),
          comparisonMaterials(fingerprintMaterials(input, false)),
        );
      });
      for (const side of ["beforeFiles", "afterFiles"] as const)
        await t.test(`${mode}/only ${side} closed`, async () => {
          const oneOpen = {
            ...input,
            [side]: new Map(
              [...input[side]].map(([route, content]) => [
                route,
                Buffer.from(content).toString() + `</${tag}>`,
              ]),
            ),
          };
          const text = await compareStyleSwitches(
            oneOpen,
            styleSwitches[0],
            false,
          );
          for (const switches of styleSwitches)
            assert.deepEqual(
              await compareStyleSwitches(oneOpen, switches),
              text,
            );
          assert.deepEqual(
            comparisonMaterials(fingerprintMaterials(oneOpen)),
            comparisonMaterials(fingerprintMaterials(oneOpen, false)),
          );
        });
    }
  });
