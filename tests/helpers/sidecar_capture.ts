import assert from "node:assert/strict";

import type { build, OnResolveArgs } from "esbuild";

import { CaptureDurability } from "../../packages/mokly/src/sidecar/capture-durability.js";
import { captureRuntime } from "../../packages/mokly/src/sidecar/capture-runtime.js";

export function capture() {
  const now = BigInt(Date.now() + 10_000) * 1_000_000n;
  return new CaptureDurability(
    { volumes: [] },
    {
      ...captureRuntime,
      platform: "linux",
      now: () => now,
      filesystem: () => 0xef53n,
    },
  );
}

/** Change a real directory only after the capture has observed this import. */
export function afterEvidence(
  options: Parameters<typeof build>[0],
  change: (args: OnResolveArgs) => Promise<void>,
) {
  const plugin = options.plugins?.find(
    (plugin) => plugin.name === "mokly-reuse-evidence",
  );
  assert.ok(plugin);
  const setup = plugin.setup;
  plugin.setup = (builder) =>
    setup({
      ...builder,
      onResolve: (options, callback) =>
        builder.onResolve(options, async (args) => {
          const result = await callback(args);
          await change(args);
          return result;
        }),
    });
}
