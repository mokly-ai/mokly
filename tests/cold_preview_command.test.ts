import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { BaselineProcessRequest } from "../dist/baseline/types.js";

import { runColdPreviewBuild } from "./helpers/cold_preview_build.js";
import { repositoryRoot } from "./helpers/fixture.js";

test("cold preview preparation invokes the real npm script with isolated output", async (t) => {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/cold-preview-command-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const output = path.join(root, "site");
  const requests: BaselineProcessRequest[] = [];
  await runColdPreviewBuild(root, output, false, {
    createSource: async () => {},
    runner: {
      pid: process.pid,
      isAlive: () => false,
      run: async (request) => {
        requests.push(request);
        return {
          exitCode: 0,
          signal: null,
          output: "",
          stdout: Buffer.alloc(0),
        };
      },
    },
  });
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0]!.argv, [
    "npm",
    "run",
    "preview:build",
    "--",
    "--out",
    output,
  ]);
  assert.equal(requests[0]!.cwd, root);
  assert.ok(requests[0]!.signal);
});

test("cold preview preparation refuses prebuilt package or example output", async (t) => {
  for (const existing of [
    "dist",
    "packages/viewer/dist",
    "examples/basic/mokly-generated",
  ]) {
    const root = await fs.mkdtemp(
      path.join(repositoryRoot, ".context/cold-preview-existing-"),
    );
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    await fs.mkdir(path.join(root, existing), { recursive: true });
    await assert.rejects(
      runColdPreviewBuild(root, path.join(root, "site"), false, {
        createSource: async () => {},
        runner: {
          pid: process.pid,
          isAlive: () => false,
          run: async () => {
            throw new Error("must not start");
          },
        },
      }),
      /Cold preview requires absent build output/u,
    );
  }
});
