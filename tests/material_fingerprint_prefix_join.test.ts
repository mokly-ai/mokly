import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  fingerprintComparison,
  fingerprintMaterials,
} from "./helpers/fingerprint_comparison.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";
import { selectedStyleViews } from "./helpers/style_route.js";
import { styleSwitches } from "./helpers/style_switches.js";

for (const mode of ["committed", "derived"] as const)
  test(`normalization-created fingerprint lookalikes preserve text materials in ${mode}`, async (context) => {
    const style = "<style>.entry{color:red}</style>";
    const digest = createHash("sha256")
      .update(style, "utf8")
      .digest("base64url");
    const fragment = `<!--mokly-in<!--mokly-review-ignore:start:clock-->line-style:${digest}--><!--mokly-review-ignore:end:clock-->`;
    const signal = `<!--mokly-review-material:clock:${"a".repeat(64)}-->`;
    const fixture = await inlineChangesFixture(
      context,
      style + fragment + signal,
      fragment + style,
      { colorSchemes: false },
    );
    const input = await pageFixtureInput(fixture, mode);
    const { before, after } = selectedStyleViews(input);
    for (const source of [
      input.beforeFiles.get(before.path)!,
      input.afterFiles.get(after.path)!,
    ])
      assert.ok(
        !Buffer.from(source).toString("utf8").includes("mokly-inline-"),
      );
    assert.equal(
      fingerprintMaterials(input, false).inlineAnalysis?.status,
      "skipped",
    );
    for (const switches of styleSwitches)
      await context.test(JSON.stringify(switches), async () => {
        const text = await fingerprintComparison(
          input,
          false,
          "home",
          undefined,
          switches,
        );
        assert.equal(text.kind, "result");
        if (text.kind !== "result") return;
        assert.equal(text.result.comparisonPath, "complete");
        assert.equal(text.result.view.state, "changed");
        assert.equal(text.result.view.material, true);
        assert.deepEqual(text.result.reasons, [{ kind: "material" }]);
        assert.deepEqual(
          await fingerprintComparison(input, true, "home", undefined, switches),
          text,
        );
      });
  });
