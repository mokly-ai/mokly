import assert from "node:assert/strict";
import test from "node:test";

import {
  assertFingerprintComparison,
  fingerprintMaterials,
} from "./helpers/fingerprint_comparison.js";
import { styleRouteFixture, withHeadStyles } from "./helpers/style_route.js";

for (const mode of ["committed", "derived"] as const)
  test(`fingerprints retain owned and entry references and omit excluded ones in ${mode}`, async (context) => {
    const base = await styleRouteFixture(context);
    const style =
      '<style>.entry{background:url("../../entry.svg")}.action{background:url("../../owned.svg")}.missing{background:url("../../unused.svg")}</style>';
    const input = withHeadStyles(base, style, style, mode);
    const fixture = {
      ...input,
      beforeFiles: new Map([
        ...input.beforeFiles,
        ["entry.svg", "before"],
        ["owned.svg", "before"],
        ["unused.svg", "before"],
      ]),
      afterFiles: new Map([
        ...input.afterFiles,
        ["entry.svg", "after"],
        ["owned.svg", "after"],
        ["unused.svg", "after"],
      ]),
      changedPaths:
        mode === "committed"
          ? ["mockups/entry.svg", "mockups/owned.svg", "mockups/unused.svg"]
          : [],
    };
    const prepared = fingerprintMaterials(fixture);
    assert.ok(
      prepared.projected.actual.base.includes("<!--mokly-inline-rules:"),
    );
    assert.deepEqual(
      new Set(prepared.references!.actualBefore),
      new Set(["../../entry.svg", "../../owned.svg"]),
    );
    assert.deepEqual(
      new Set(prepared.references!.before),
      new Set(["../../entry.svg"]),
    );
    assert.deepEqual(
      prepared.references,
      fingerprintMaterials(fixture, false).references,
    );
    const comparison = await assertFingerprintComparison(fixture);
    assert.equal(comparison.kind, "result");
    if (comparison.kind === "result")
      assert.equal(comparison.result.view.state, "changed");
  });
