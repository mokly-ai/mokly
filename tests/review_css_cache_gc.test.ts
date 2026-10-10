import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const helper = new URL("./helpers/css_cache_gc.mjs", import.meta.url);

async function heapProbe(
  slot: string,
  mode = "copy",
  script = helper,
  cwd = process.cwd(),
) {
  const { stdout } = await run(
    process.execPath,
    ["--expose-gc", "--import", "tsx", fileURLToPath(script), slot, mode],
    { cwd },
  );
  return JSON.parse(stdout) as {
    allocatedBytes: number;
    releasedBytes: number;
    retainedBytes: number;
  };
}

test("GC probes work in a checkout path containing spaces", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly cache gc-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const checkout = path.join(root, "checkout with spaces");
  await fs.symlink(process.cwd(), checkout, "dir");
  const script = pathToFileURL(
    path.join(checkout, "tests/helpers/css_cache_gc.mjs"),
  );
  const probe = await heapProbe("key", "copy", script, checkout);
  assert.ok(
    probe.releasedBytes > probe.allocatedBytes * 0.8,
    JSON.stringify(probe),
  );
});

test("the GC probe's sliced-key control retains its 48 MiB parent", async () => {
  const probe = await heapProbe("key", "sliced-control");
  assert.ok(probe.allocatedBytes > 40 * 1024 * 1024, JSON.stringify(probe));
  assert.ok(
    probe.retainedBytes > probe.allocatedBytes * 0.8,
    JSON.stringify(probe),
  );
});

for (const slot of [
  "key",
  "key-hit",
  "selector",
  "declarations",
  "condition-prelude",
  "condition-kind",
  "atRule",
  "prelude",
  "data-addressKey",
  "data-identityKey",
  "data-canonicalText",
  "data-reference",
  "identity-run",
  "error-message",
  "error-name",
  "error-stack",
  "error-code",
  "error-payload",
])
  test(`caching a sliced ${slot} releases its 48 MiB parent after GC`, async () => {
    const probe = await heapProbe(slot);
    assert.ok(probe.allocatedBytes > 40 * 1024 * 1024, JSON.stringify(probe));
    assert.ok(
      probe.releasedBytes > probe.allocatedBytes * 0.8,
      JSON.stringify(probe),
    );
    assert.ok(
      probe.retainedBytes < probe.allocatedBytes * 0.2,
      JSON.stringify(probe),
    );
  });
