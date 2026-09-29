import assert from "node:assert/strict";
import test from "node:test";

import { receiveWatchedState } from "../dist/server/child.js";

test("watched startup times out when rebuild status is absent", async () => {
  const received = receiveWatchedState(10);
  process.emit("message", {
    runtime: {
      bundle: { code: "export {};", map: "" },
      generation: "a".repeat(32),
      interactiveEntries: {},
      outputs: [],
    },
    type: "component-runtime",
    version: 1,
  });
  await assert.rejects(received, /Watched state transfer timed out/);
});
