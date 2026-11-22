import assert from "node:assert/strict";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { restore } from "../packages/mokly/src/sidecar/compiled.js";
import { describe } from "../packages/mokly/src/sidecar/describe.js";
import { ExportNameCache } from "../packages/mokly/src/sidecar/export-name-cache.js";
import { jsonText } from "../packages/mokly/src/sidecar/json.js";

import {
  describeFixture,
  registrationState,
} from "./helpers/describe_cache.js";
import { parserProbe } from "./helpers/export_cache.js";

test("successive cached describes preserve exact bytes registrations slots and stories", async (context) => {
  const fixture = await describeFixture(context);
  const counted = parserProbe();
  const cold = parserProbe();
  const cached = new ExportNameCache(undefined, counted.parser);
  const uncached = new ExportNameCache(0, cold.parser);
  for (const stage of [0, 1, 2, 3, 4]) {
    await fixture.revision(stage);
    const built = await bundle(fixture.params, build);
    const warmGeneration = restore(
      fixture.params,
      built.result.compiled,
      built.result.modules,
    );
    const coldGeneration = restore(
      fixture.params,
      built.result.compiled,
      built.result.modules,
    );
    warmGeneration.maps = {};
    coldGeneration.maps = {};
    assert.equal(warmGeneration.definitions, undefined);
    assert.equal(coldGeneration.definitions, undefined);
    const actual = await describe(warmGeneration, cached);
    const expected = await describe(coldGeneration, uncached);
    assert.equal(
      jsonText(actual),
      jsonText(expected),
      `stage ${stage} definitions`,
    );
    assert.deepEqual(
      registrationState(warmGeneration),
      registrationState(coldGeneration),
      `stage ${stage} registrations`,
    );
    assert.deepEqual(
      actual.pages.map((entry) => entry.handle),
      [
        "a.mockup.ts#Zed",
        ...(stage === 3 ? [] : ["a.mockup.ts#Alpha"]),
        ...(stage === 2 || stage === 3 ? ["a.mockup.ts#Added"] : []),
      ],
    );
    assert.deepEqual(
      actual.stories.map((story) => story.id),
      ["button.stories.tsx#Zulu", "button.stories.tsx#Alpha"],
    );
    assert.deepEqual(
      actual.diagnostics.map((diagnostic) => diagnostic.code),
      ["duplicate-export"],
    );
    assert.deepEqual(
      [...warmGeneration.savedSlots.keys()],
      ["b.mockup.tsx#Beta:slot:0:children"],
    );
  }
  assert.equal(counted.calls.length, 6);
  assert.equal(cold.calls.length, 15);
});
