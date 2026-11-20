import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { ModulePaths } from "../packages/mokly/src/sidecar/module-paths.js";
import { resolutionInputs } from "../packages/mokly/src/sidecar/resolution-inputs.js";

import { bundleParams } from "./helpers/sidecar.js";

const exec = promisify(execFile);

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

test(
  "resolution directory lists include special files and exclude directories",
  { skip: process.platform === "win32" },
  async (context) => {
    const root = await fs.realpath(
      await fs.mkdtemp(path.join(tmpdir(), "mokly-resolution-kinds-")),
    );
    context.after(() => fs.rm(root, { recursive: true, force: true }));
    const file = path.join(root, "entry.ts");
    await fs.writeFile(file, "export const value = 1;");
    await fs.mkdir(path.join(root, "folder"));
    await fs.symlink("folder", path.join(root, "linked-folder"), "dir");
    const paths = await ModulePaths.create(bundleParams({ sourceRoot: root }));
    const before = await resolutionInputs(paths, [file], {}, {});
    assert.deepEqual(before.inputDirectories[root], [
      "entry.ts",
      "linked-folder",
    ]);
    await exec("mkfifo", [path.join(root, "a.ts")]);
    const after = await resolutionInputs(paths, [file], {}, {});
    assert.deepEqual(after.inputDirectories[root], [
      "a.ts",
      "entry.ts",
      "linked-folder",
    ]);
    assert.deepEqual(after.metadataDirectories[paths.metadataName(root)], [
      "a.ts",
      "entry.ts",
      "linked-folder",
    ]);
  },
);
