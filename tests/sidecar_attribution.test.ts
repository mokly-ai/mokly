import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { Definitions } from "../packages/mokly/src/generated/sidecar/Definitions.js";

import { bundleParams, startSidecar } from "./helpers/sidecar.js";

test("installed packages use an unattributed facade with intact definition identity", async (context) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-sidecar-consumer-"),
  );
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const installed = path.join(root, "node_modules/installed");
  await fs.mkdir(installed, { recursive: true });
  await fs.writeFile(
    path.join(installed, "package.json"),
    JSON.stringify({ name: "installed", type: "module", main: "index.js" }),
  );
  await fs.writeFile(
    path.join(installed, "index.js"),
    'import {definePage} from "@mokly/mokly"; export const page = definePage({title:"Installed",description:"Installed page",relatedDocs:[],render:()=>"document"});',
  );
  await fs.writeFile(
    path.join(root, "entry.mjs"),
    'export { page } from "installed";',
  );
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const bundled = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      sourceRoot: root,
      entryFiles: ["entry.mjs"],
      renderer: null,
      storiesFiles: [],
    }),
  );
  await sidecar.call("cssModules", {
    generation: bundled.generation,
    classMaps: {},
  });
  const definitions = await sidecar.call<Definitions>("describe", {
    generation: bundled.generation,
  });
  assert.deepEqual(definitions.diagnostics, []);
  assert.equal(definitions.pages[0]?.handle, "entry.mjs#page");
  assert.equal(definitions.pages[0]?.sourcePath, undefined);
  await sidecar.call("shutdown");
});

test("shared factories keep their module and aliases keep the first source export", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  for (const entryFiles of [
    ["identity-a.mjs"],
    ["identity-b.mjs", "identity-a.mjs"],
  ]) {
    const bundled = await sidecar.call<BundleResult>(
      "bundle",
      bundleParams({ entryFiles, renderer: null, storiesFiles: [] }),
    );
    await sidecar.call("cssModules", {
      generation: bundled.generation,
      classMaps: {},
    });
    const definitions = await sidecar.call<Definitions>("describe", {
      generation: bundled.generation,
    });
    assert.equal(definitions.pages.length, 1);
    assert.equal(definitions.pages[0]?.handle, "identity-a.mjs#Zebra");
    assert.equal(definitions.pages[0]?.sourcePath, "identity-helper.mjs");
    assert.deepEqual(
      definitions.diagnostics.map((diagnostic) => diagnostic.code),
      entryFiles.length === 1 ? [] : ["duplicate-export"],
    );
  }
  await sidecar.call("shutdown");
});
