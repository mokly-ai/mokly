import assert from "node:assert/strict";
import nodeFs from "node:fs";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { SidecarError } from "../packages/mokly/src/sidecar/errors.js";
import { ModulePaths } from "../packages/mokly/src/sidecar/module-paths.js";
import {
  directoryFiles,
  resolutionInputs,
} from "../packages/mokly/src/sidecar/resolution-inputs.js";
import { FRAME_LIMIT } from "../packages/mokly/src/sidecar/transport.js";

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

test("directory lists retain files and links within the exact byte limit", async (context) => {
  context.mock.method(fs, "opendir", () => {
    assert.fail("directory lists must use the synchronous filesystem boundary");
  });
  context.mock.method(
    nodeFs,
    "readdirSync",
    (directory: string, options: { withFileTypes: boolean }) => {
      assert.equal(directory, "directory");
      assert.deepEqual(options, { withFileTypes: true });
      return [
        { name: "z", isFile: () => true, isSymbolicLink: () => false },
        { name: "folder", isFile: () => false, isSymbolicLink: () => false },
        { name: "ln", isFile: () => false, isSymbolicLink: () => true },
        { name: "a", isFile: () => true, isSymbolicLink: () => false },
      ];
    },
  );
  assert.deepEqual(await directoryFiles("directory", 15), ["a", "ln", "z"]);
  await assert.rejects(directoryFiles("directory", 14), (error) => {
    assert.ok(error instanceof SidecarError);
    assert.equal(error.code, "bundle-failed");
    assert.equal(
      error.message,
      `Compiled bundle data needs more than ${FRAME_LIMIT} bytes. The sidecar limit is ${FRAME_LIMIT} bytes. Reduce the bundle and retry.`,
    );
    return true;
  });
});

test("directory lists map only missing inputs to empty membership", async (context) => {
  context.mock.method(fs, "opendir", () => {
    assert.fail("directory lists must use the synchronous filesystem boundary");
  });
  let failure = Object.assign(new Error("missing"), { code: "ENOENT" });
  context.mock.method(nodeFs, "readdirSync", () => {
    throw failure;
  });
  for (const code of ["ENOENT", "ENOTDIR"]) {
    failure = Object.assign(new Error(code), { code });
    assert.deepEqual(await directoryFiles("candidate"), []);
  }
  failure = Object.assign(new Error("forbidden"), { code: "EACCES" });
  await assert.rejects(
    directoryFiles("candidate"),
    (error) => error === failure,
  );
});
