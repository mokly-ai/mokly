import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";
import { promisify } from "node:util";

const run = promisify(execFile);
const helper = new URL("./helpers/css_cache_gc.mjs", import.meta.url);

async function heapProbe(slot: string, mode = "copy") {
  const { stdout } = await run(process.execPath, [
    "--expose-gc",
    "--import",
    "tsx",
    helper.pathname,
    slot,
    mode,
  ]);
  return JSON.parse(stdout) as {
    allocatedBytes: number;
    releasedBytes: number;
    retainedBytes: number;
  };
}

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
  "error-message",
  "error-name",
  "error-stack",
  "error-code",
  "error-payload",
  "error-property-key",
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
