import path from "node:path";

import { CaptureDurability } from "../../packages/mokly/src/sidecar/capture-durability.js";
import { captureRuntime } from "../../packages/mokly/src/sidecar/capture-runtime.js";
import type { CaptureStat } from "../../packages/mokly/src/sidecar/capture-runtime.js";

/** Isolate shared ancestor stamps while retaining real reads inside the fixture. */
export function planCapture(root: string): CaptureDurability {
  const ancestors = new Map<string, CaptureStat>();
  for (let parent = path.dirname(root); ; parent = path.dirname(parent)) {
    ancestors.set(parent, captureRuntime.lstat(parent));
    if (path.dirname(parent) === parent) break;
  }
  const now = BigInt(Date.now() + 10_000) * 1_000_000n;
  const capture = new CaptureDurability(
    { volumes: [] },
    {
      ...captureRuntime,
      platform: "linux",
      now: () => now,
      filesystem: () => 0xef53n,
      lstat: (file) => ancestors.get(file) ?? captureRuntime.lstat(file),
      stat: (file) => ancestors.get(file) ?? captureRuntime.stat(file),
    },
  );
  // Physical input reads bypass the capture runtime when they supply stamps.
  const observe = capture.observe.bind(capture);
  capture.observe = (file, stat, follow, metadata) =>
    observe(file, ancestors.get(file) ?? stat, follow, metadata);
  return capture;
}
