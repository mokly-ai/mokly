import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { cleanup, recoveryFixture } from "./helpers/static_faults.js";
import { faultReadiness, signalFault } from "./helpers/static_signal.js";

test("fault readiness observes complete markers and releases its watcher on abort", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-signal-ready-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, ".context"));
  const signal = new AbortController();
  const waiting = faultReadiness(root, "capture-signal", signal.signal);
  const stopped = assert.rejects(waiting.ready, /fixture cancelled/u);
  signal.abort(new Error("fixture cancelled"));
  await stopped;

  await fs.writeFile(path.join(root, ".context/ready"), "capture-signal");
  const recorded = faultReadiness(root, "capture-signal", context.signal);
  await recorded.ready;
  recorded.close();
});

test(
  "an aborted signal fixture reaps the shim and native process held at a complete marker",
  { timeout: 120_000 },
  async (context) => {
    const root = await recoveryFixture(context.signal);
    const signal = new AbortController();
    const held = faultReadiness(root, "config", context.signal);
    context.after(() => held.close());
    context.after(() => cleanup(root, "build"));
    const running = signalFault(
      root,
      "build",
      "plain",
      "unreached,config",
      AbortSignal.any([signal.signal, context.signal]),
    );
    const stopped = assert.rejects(running, /fixture cancelled/u);
    if (process.platform !== "win32") {
      await held.ready;
      assert.equal(
        await fs.readFile(path.join(root, ".context/ready"), "utf8"),
        "config",
      );
      context.diagnostic(
        "The native process reached the complete config marker.",
      );
    }
    signal.abort(new Error("fixture cancelled"));
    held.close();
    await stopped;
  },
);
