import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { EXAMPLE_SNAPSHOT_PATH } from "../scripts/verification/example-snapshot-key.mjs";
import { requirePrepared } from "../scripts/verification/prepared.mjs";

const PACKAGE_OUTPUTS = [
  "dist/cli/bin.js",
  "packages/viewer/dist/browser/inspector.js",
];
const EXAMPLE_MANIFEST = "examples/basic/mokly-generated/mokly-manifest.json";

async function preparedRoot(
  t: test.TestContext,
  files: readonly string[],
): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-prepared-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const file of files) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), "");
  }
  return root;
}

test("the unit kind also requires the example compilation snapshot", async (t) => {
  const root = await preparedRoot(t, [...PACKAGE_OUTPUTS, EXAMPLE_MANIFEST]);
  await assert.rejects(requirePrepared(root, "unit"), {
    message: `prepared verification output is missing: ${EXAMPLE_SNAPSHOT_PATH}; run npm run prepare:unit first`,
  });
  await requirePrepared(root);
  await fs.mkdir(path.join(root, EXAMPLE_SNAPSHOT_PATH), { recursive: true });
  await assert.rejects(requirePrepared(root, "unit"), /prepare:unit/u);
  await fs.rm(path.join(root, EXAMPLE_SNAPSHOT_PATH), { recursive: true });
  await fs.writeFile(path.join(root, EXAMPLE_SNAPSHOT_PATH), "{}\n");
  await requirePrepared(root, "unit");
});

test("the unit kind names every missing output and the unit preparation", async (t) => {
  const root = await preparedRoot(t, []);
  await assert.rejects(requirePrepared(root, "unit"), {
    message: `prepared verification output is missing: ${[
      ...PACKAGE_OUTPUTS,
      EXAMPLE_MANIFEST,
      EXAMPLE_SNAPSHOT_PATH,
    ].join(", ")}; run npm run prepare:unit first`,
  });
});

test("the other kinds keep the ordinary preparation", async (t) => {
  const root = await preparedRoot(t, [EXAMPLE_SNAPSHOT_PATH]);
  for (const [kind, missing] of [
    [undefined, [...PACKAGE_OUTPUTS, EXAMPLE_MANIFEST]],
    ["all", [...PACKAGE_OUTPUTS, EXAMPLE_MANIFEST]],
    ["package", PACKAGE_OUTPUTS],
    ["example", [EXAMPLE_MANIFEST]],
  ] as const)
    await assert.rejects(requirePrepared(root, kind), {
      message: `prepared verification output is missing: ${missing.join(", ")}; run npm run prepare:verification first`,
    });
  await assert.rejects(
    requirePrepared(root, "browser" as never),
    /unknown prepared output kind browser/u,
  );
});
