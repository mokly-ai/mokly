import assert from "node:assert/strict";
import test from "node:test";

import { compactRuntime } from "../dist/build/compact_runtime.js";
import { compileCatalogue } from "../dist/build/compile.js";
import { componentRuntime } from "../dist/build/component_runtime.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("runtime compaction preserves resolved per-entry opt-outs", async (t) => {
  const fixture = await createFixture(`
import React from "react";
import { defineScreen } from "@mokly/mokly";
export const mockups = [defineScreen({
  dependencies: [], description: "Static only", desktop: <main>Desktop</main>,
  path: "static-only", interactive: false, mobile: <main>Mobile</main>,
  relatedDocs: [], title: "Static only"
})];
`);
  t.after(() => removeFixture(fixture));
  const runtime = componentRuntime(
    await compileCatalogue(await loadConfig(fixture.root)),
  );
  const compacted = compactRuntime(runtime);
  const manifest = compacted.manifest;
  assert.equal(manifest.schemaVersion, "live-index-1");
  if (manifest.schemaVersion !== "live-index-1")
    throw new Error("Expected a compact catalogue index");
  const entry = manifest.entries.find(
    (candidate) => candidate.path === "static-only",
  );

  assert.equal(runtime.interactiveEntries["static-only"], false);
  assert.equal(entry?.kind === "screen" ? entry.interactive : undefined, false);
});
