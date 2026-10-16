import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { ModulePaths } from "../packages/mokly/src/sidecar/module-paths.js";
import { resolutionInputs } from "../packages/mokly/src/sidecar/resolution-inputs.js";

import { bundleParams } from "./helpers/sidecar.js";

test("resolution directory names remain own data keys", async (context) => {
  const root = await fs.mkdtemp(
    path.join(tmpdir(), "mokly-resolution-inputs-"),
  );
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(root, "__proto__");
  await fs.mkdir(directory);
  const file = path.join(directory, "entry.ts");
  await fs.writeFile(file, "export const value = 1;");
  const paths = await ModulePaths.create(bundleParams({ sourceRoot: root }));
  const result = await resolutionInputs(paths, [file], {}, {});
  assert.ok(Object.hasOwn(result.metadataDirectories, "__proto__"));
  assert.deepEqual(result.metadataDirectories["__proto__"], ["entry.ts"]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(result)).metadataDirectories["__proto__"],
    ["entry.ts"],
  );
});
