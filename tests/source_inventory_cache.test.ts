import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { validateGeneratedOutputPaths } from "../dist/build/output_paths.js";
import { generatedOwnershipDenial } from "../dist/build/ownership.js";
import { isAuthoringSource } from "../dist/build/source_inventory.js";
import { loadConfig } from "../dist/config/load.js";
import { MANIFEST_NAME } from "../dist/registry/manifest.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("manifest classification reuses the source index across validation, ownership and spread configs", async (t) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'publicExclude: ["mokly-manifest.json"],',
  });
  t.after(() => removeFixture(fixture));
  const config = {
    ...(await loadConfig(fixture.root)),
    sourceFiles: Object.freeze(["entries/fixture.mockup.tsx"]),
  };
  const realpath = t.mock.method(fs.realpathSync, "native");
  const inventoryResolutions = () =>
    realpath.mock.calls.filter(
      (call) => call.arguments[0] === fixture.entryPath,
    ).length;
  assert.equal(
    isAuthoringSource(path.join(config.mockupsDir, "public.html"), config),
    undefined,
  );
  assert.equal(inventoryResolutions(), 1, "the first lookup builds the index");
  for (const current of [config, { ...config }]) {
    validateGeneratedOutputPaths([MANIFEST_NAME], current);
    assert.equal(
      generatedOwnershipDenial(
        path.join(config.mockupsDir, MANIFEST_NAME),
        current,
      ),
      undefined,
    );
    assert.equal(
      inventoryResolutions(),
      1,
      "manifest checks must reuse the accepted inventory's index",
    );
    assert.deepEqual(
      isAuthoringSource(path.join(config.mockupsDir, MANIFEST_NAME), current),
      { kind: "exclusion", glob: MANIFEST_NAME },
    );
  }
  config.sourceFiles = Object.freeze([...config.sourceFiles]);
  validateGeneratedOutputPaths([MANIFEST_NAME], config);
  assert.equal(inventoryResolutions(), 2, "a new inventory gets a fresh index");
});
