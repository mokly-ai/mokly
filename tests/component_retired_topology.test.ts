import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { componentUsageTopologyEqual } from "../dist/components/comparison_material.js";
import { loadConfig } from "../dist/config/load.js";
import {
  parseHistoricalManifest,
  parseManifest,
} from "../dist/registry/manifest.js";
import type { ManifestV8 } from "../packages/viewer/dist/registry/types.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

for (const [field, before, after] of [
  [
    "styles",
    [{ startOffset: 0, endOffset: 10, componentIds: ["pane"] }],
    [{ startOffset: 0, endOffset: 11, componentIds: ["pane"] }],
  ],
  [
    "resources",
    [{ path: "pane.css", componentIds: ["pane"] }],
    [{ path: "other.css", componentIds: ["pane"] }],
  ],
] as const)
  test(`retired ${field} topology is rejected currently and discarded historically`, async (context) => {
    const fixture = await createFixture(componentEntrySource());
    context.after(() => removeFixture(fixture));
    const original = (await compileCatalogue(await loadConfig(fixture.root)))
      .manifest;
    const base = structuredClone(original);
    const head = structuredClone(original);
    Object.assign(usage(base), { [field]: before });
    Object.assign(usage(head), { [field]: after });
    assert.throws(() => parseManifest(structuredClone(base)), /unknown field/);
    assert.throws(() => parseManifest(structuredClone(head)), /unknown field/);
    const baseline = usage(parseHistoricalManifest(base));
    const current = usage(parseHistoricalManifest(head));
    assert.deepEqual(baseline, usage(original));
    assert.deepEqual(current, usage(original));
    assert.equal(componentUsageTopologyEqual(baseline, current), true);
  });

function usage(manifest: ManifestV8) {
  const screen = manifest.entries.find((entry) => entry.kind === "screen");
  assert.ok(screen?.kind === "screen" && screen.componentViews?.[0]);
  return screen.componentViews[0];
}
