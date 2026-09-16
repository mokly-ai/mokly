import assert from "node:assert/strict";
import test from "node:test";

import { resolvePublicExclude } from "../dist/config/public_exclusions.js";
import { receiveComponentRuntimeStartup } from "../dist/server/controls/runtime_ipc.js";

function startup(publicExclude?: unknown): object {
  return {
    type: "component-runtime-startup",
    config: {
      configPath: "/repo/mokly.config.ts",
      entriesDir: "/repo/entries",
      mockupsDir: "/repo/generated",
      repoRoot: "/repo",
      ...(publicExclude === undefined ? {} : { publicExclude }),
    },
    manifest: { entries: [], schemaVersion: 5, sourceFiles: [] },
  };
}

test("runtime startup preserves resolved public exclusions without duplicating defaults", async () => {
  const resolved = resolvePublicExclude(["internal/**"]);
  const transferred = structuredClone(resolved);
  const received = receiveComponentRuntimeStartup();
  process.emit("message", startup(transferred));
  const { config } = await received;
  assert.deepEqual(config.publicExclude, transferred);
  assert.equal(config.publicExclude.length, 5);
  assert.ok(Object.isFrozen(config.publicExclude));
  assert.notEqual(config.publicExclude, transferred);
  assert.deepEqual(transferred, resolved);
  assert.equal(Object.isFrozen(transferred), false);
  const resolvedAgain = resolvePublicExclude(transferred);
  assert.equal(resolvedAgain.length, 9);
  assert.notDeepEqual(config.publicExclude, resolvedAgain);
});

for (const [label, value] of [
  ["a missing value", undefined],
  ["a non-array", "internal/**"],
  ["an unsafe glob", ["../secret/**"]],
] as const) {
  test(`runtime startup rejects ${label} and waits for valid public exclusions`, async () => {
    const accepted = resolvePublicExclude(["accepted/**"]);
    const received = receiveComponentRuntimeStartup();
    process.emit("message", startup(value));
    process.emit("message", startup(accepted));
    const { config } = await received;
    assert.deepEqual(config.publicExclude, accepted);
    assert.ok(Object.isFrozen(config.publicExclude));
  });
}
