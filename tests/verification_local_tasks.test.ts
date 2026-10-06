import assert from "node:assert/strict";
import test from "node:test";

import { runLocalTasks } from "../scripts/verification/local-tasks.mjs";
import {
  localWorkerLimit,
  verificationTasks,
} from "../scripts/verification/local-workers.mjs";

test("local scheduling starts long independent shards before shorter ones", () => {
  const tasks = verificationTasks();
  assert.equal(tasks.length, 11);
  assert.deepEqual(
    tasks.slice(0, 5).map((task) => task.key),
    ["repository", "hydration", "browser-2", "unit-4", "package"],
  );
  assert.deepEqual(
    tasks.slice(5).map((task) => task.key),
    ["browser-3", "browser-4", "browser-1", "unit-1", "unit-2", "unit-3"],
  );
  assert.equal(new Set(tasks.map((task) => task.key)).size, 11);
  assert.equal(localWorkerLimit(16), 4);
  assert.equal(localWorkerLimit(12), 4);
  assert.equal(localWorkerLimit(7), 2);
  assert.equal(localWorkerLimit(8), 2);
  assert.equal(localWorkerLimit(3), 1);
  assert.equal(localWorkerLimit(1), 1);
});

test("task fan-out stops dispatch on failure and drains existing workers", async () => {
  const started: string[] = [];
  const finished: string[] = [];
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await assert.rejects(
    runLocalTasks(
      ["fail", "active", "not-started"],
      2,
      async (task) => {
        started.push(task);
        if (task === "fail") throw new Error("first failure");
        await held;
        finished.push(task);
      },
      async () => {
        release();
      },
    ),
    /first failure/,
  );
  assert.deepEqual(started, ["fail", "active"]);
  assert.deepEqual(finished, ["active"]);
});
