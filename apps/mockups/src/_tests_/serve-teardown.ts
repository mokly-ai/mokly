/**
 * The served suite's global teardown. Playwright runs it before it stops its
 * web server, so it compares the build output and the checkout after the
 * suite, stops Serve itself, and compares them again after Serve has exited.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

import {
  recordedState,
  serveExitFile,
  serveProcessFile,
  servedState,
} from "./served-files";

/** Ask Serve to stop, and wait until the launcher records its exit. */
async function stopServe() {
  if (!existsSync(serveExitFile)) {
    const record: unknown = JSON.parse(readFileSync(serveProcessFile, "utf8"));
    assert.ok(
      typeof record === "object" &&
        record !== null &&
        "pid" in record &&
        typeof record.pid === "number",
      "The launcher recorded no Serve process",
    );
    process.kill(record.pid, "SIGTERM");
  }
  const deadline = Date.now() + 30_000;
  while (!existsSync(serveExitFile)) {
    if (Date.now() > deadline)
      throw new Error("Serve did not stop within 30 seconds");
    await delay(100);
  }
}

export default async function verifyServedOutput() {
  const before = recordedState();
  assert.deepEqual(
    servedState(),
    before,
    "The build output or the checkout changed during the served suite",
  );
  await stopServe();
  assert.deepEqual(
    servedState(),
    before,
    "The build output or the checkout changed when Serve stopped",
  );
}
