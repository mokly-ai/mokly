/** How `npm run dev:cloud` stops a service and the processes it started. */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { startService } from "./dev-processes.mjs";

/** Whether any process of the group still runs. */
function groupExists(group) {
  try {
    process.kill(-group, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

test("stops a child that ignores SIGTERM after the service's first process exits", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "mokly-dev-stop-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const ready = path.join(directory, "ready");
  // The shell exits on SIGTERM. Its child ignores SIGTERM, and touches the
  // ready file once it has set that up.
  const script = `(trap '' TERM; touch "$1"; while :; do sleep 1; done) & wait`;
  const service = startService("child", "sh", ["-c", script, "sh", ready], {
    cwd: directory,
    env: process.env,
    graceMs: 200,
  });
  t.after(() => {
    if (service.pid !== undefined && groupExists(service.pid))
      process.kill(-service.pid, "SIGKILL");
  });
  while (!existsSync(ready)) await delay(20);

  await service.stop();

  assert.equal(groupExists(service.pid), false);
});
