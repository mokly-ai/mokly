import assert from "node:assert/strict";
import test from "node:test";

import { CaptureDurability } from "../packages/mokly/src/sidecar/capture-durability.js";
import type {
  CaptureRuntime,
  CaptureStat,
} from "../packages/mokly/src/sidecar/capture-runtime.js";

test("retained raw link targets cannot exceed the visited-path bound", async () => {
  const directory: CaptureStat = {
    dev: 1n,
    ino: 2n,
    ctimeNs: 10_000_000_001n,
    mtimeNs: 10_000_000_001n,
    size: 0n,
    isDirectory: () => true,
    isFile: () => false,
    isSymbolicLink: () => false,
  };
  const link: CaptureStat = {
    ...directory,
    isDirectory: () => false,
    isSymbolicLink: () => true,
  };
  const runtime: CaptureRuntime = {
    platform: "linux",
    now: () => 20_000_000_000n,
    wait: async () => {
      throw new Error("unexpected barrier");
    },
    lstat: async (file) =>
      file.startsWith("/capture/links/link-") ? link : directory,
    stat: async () => directory,
    readlink: async () => "./".repeat(2000) + "../shared",
    handleStat: async () => {
      throw new Error("unexpected handle stat");
    },
    filesystem: async () => 0xef53n,
  };
  const capture = new CaptureDurability({ volumes: [] }, runtime);
  await capture.path("/capture/links/link-0");
  assert.equal(await capture.finish(), true);
  for (let index = 1; index < 2300; index++)
    await capture.path(`/capture/links/link-${index}`);
  assert.equal(await capture.finish(), false);
});
