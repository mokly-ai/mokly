import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

for (const [name, extra, exports, diagnostic] of [
  [
    "forged variants",
    "const forged = { ...action.entries[0], variants: {} };",
    "forged, pane.entries,",
    /variant/,
  ],
  ["mutated variants", "action.entries.length = 1;", undefined, /variant/],
  [
    "mutated controls",
    'action.entries[0].controls = { unknown: { kind: "text" } };',
    undefined,
    /control/,
  ],
  [
    "mutated render",
    "action.entries[0].render = null;",
    undefined,
    /render must be a function/,
  ],
  [
    "mutated props",
    "action.entries[1].props = { label: 42 };",
    undefined,
    /label/,
  ],
] as const) {
  test(`registry validates ${name} before rendering`, async (t) => {
    const fixture = await createFixture(
      componentEntrySource({ extra, ...(exports ? { exports } : {}) }),
    );
    t.after(() => removeFixture(fixture));
    await assert.rejects(
      compileCatalogue(await loadConfig(fixture.root)),
      (error: Error) => {
        assert.notEqual(error.name, "TypeError");
        assert.match(error.message, /component/i);
        assert.match(error.message, diagnostic);
        return true;
      },
    );
  });
}

test("component variant ids use registry-wide duplicate-id diagnostics", async (t) => {
  const fixture = await createFixture(
    componentEntrySource().replace(
      'id: "action-disabled"',
      'id: "action-default"',
    ),
  );
  t.after(() => removeFixture(fixture));
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    /\[duplicate-id\].*action-default/,
  );
});
