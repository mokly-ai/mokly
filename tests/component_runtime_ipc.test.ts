import assert from "node:assert/strict";
import test from "node:test";

import { receiveComponentRuntimeStartup } from "../dist/server/controls/runtime_ipc.js";

import { currentManifest } from "./helpers/current_manifest.js";

function startup(generatedDir: unknown): object {
  return {
    type: "component-runtime-startup",
    config: {
      configPath: "/repo/mokly.config.ts",
      roots: [
        {
          dir: "/repo/entries",
          files: ["**/*.mockup.{ts,tsx}"],
          transparent: [],
        },
      ],
      mockupsDir: "/repo/mockups",
      generatedDir,
      repoRoot: "/repo",
    },
    manifest: currentManifest({
      entries: [],
      folders: [],
      schemaVersion: 9,
      sourceFiles: [],
    }),
  };
}

test("runtime startup transfers the generated root without reconstructing it", async () => {
  const received = receiveComponentRuntimeStartup();
  process.emit("message", startup("/repo/mockups/mokly-generated"));
  const { config } = await received;
  assert.equal(config.generatedDir, "/repo/mockups/mokly-generated");
});

for (const [label, value] of [
  ["a missing value", undefined],
  ["a non-string value", ["mokly-generated"]],
] as const) {
  test(`runtime startup rejects ${label} and waits for a valid generated root`, async () => {
    const received = receiveComponentRuntimeStartup();
    process.emit("message", startup(value));
    process.emit("message", startup("/repo/mockups/mokly-generated"));
    const { config } = await received;
    assert.equal(config.generatedDir, "/repo/mockups/mokly-generated");
  });
}
