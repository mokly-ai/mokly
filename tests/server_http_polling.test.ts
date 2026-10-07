import assert from "node:assert/strict";
import test from "node:test";

import { waitFor } from "./helpers/server_http.js";

test("HTTP state waits ignore probe failures while the watched child restarts", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
  let probes = 0;
  const waiting = waitFor(async () => {
    if (++probes === 1) throw new Error("child is restarting");
    return true;
  });
  await new Promise(setImmediate);
  assert.equal(probes, 1);
  t.mock.timers.tick(49);
  await new Promise(setImmediate);
  assert.equal(probes, 1);
  t.mock.timers.tick(1);
  await waiting;
  assert.equal(probes, 2);
});

for (const timeoutMs of [undefined, 1_000, 20_000]) {
  test(`HTTP state waits keep at least 15 seconds (requested ${timeoutMs ?? "default"})`, async (t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
    let settled = false;
    const waiting = waitFor(async () => false, timeoutMs);
    const rejected = assert.rejects(waiting, {
      message: "watched condition did not become true",
    });
    void waiting.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await new Promise(setImmediate);
    const allowance = Math.max(15_000, timeoutMs ?? 15_000);
    t.mock.timers.tick(allowance - 1);
    await new Promise(setImmediate);
    assert.equal(settled, false);
    t.mock.timers.tick(50);
    await rejected;
    assert.equal(settled, true);
  });
}
