import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { setTimeout as pause } from "node:timers/promises";

import { FULL_CATALOGUE_SETUP_TIMEOUT_MS } from "./helpers/fixture_timing.js";
import { createOwnedExample } from "./helpers/owned_example.js";
import { prepareSharedExample } from "./helpers/shared_example.js";

test("shared preparation keeps the established 600-second ceiling", () => {
  assert.equal(FULL_CATALOGUE_SETUP_TIMEOUT_MS, 600_000);
});

test("cancelled global setup publishes no descriptor and drains its owner", async () => {
  const controller = new AbortController();
  const owner = await createOwnedExample({ signal: controller.signal });
  let entered = (): void => {};
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const preparation = prepareSharedExample({
    createOwner: async () => owner,
    createSource: async (root) => {
      await fs.writeFile(path.join(root, "partial"), "partial");
      entered();
      return new Promise<never>((_resolve, reject) => {
        owner.signal.addEventListener(
          "abort",
          () => reject(owner.signal.reason),
          { once: true },
        );
      });
    },
  });
  const rejected = assert.rejects(preparation, /stop global setup/u);
  await started;
  controller.abort(new Error("stop global setup"));
  await rejected;
  await assert.rejects(fs.access(path.dirname(owner.root)), { code: "ENOENT" });
});

test("failed shared preparation publishes no descriptor and removes its owned tree", async () => {
  const owner = await createOwnedExample();
  const failure = new Error("source setup failed");
  await assert.rejects(
    prepareSharedExample({
      createOwner: async () => owner,
      createSource: async (root) => {
        await fs.writeFile(path.join(root, "partial"), "partial");
        throw failure;
      },
    }),
    (error) => error === failure,
  );
  await assert.rejects(fs.access(path.dirname(owner.root)), { code: "ENOENT" });
});

test("unconfirmed cleanup retains preparation diagnostics and both failures", async () => {
  const owner = await createOwnedExample();
  const failure = new Error("source setup failed"),
    cleanup = new Error("termination unconfirmed");
  try {
    await assert.rejects(
      prepareSharedExample({
        createOwner: async () => ({
          ...owner,
          close: async () => {
            throw cleanup;
          },
        }),
        createSource: async (root) => {
          await fs.writeFile(path.join(root, "diagnostic"), "kept");
          throw failure;
        },
      }),
      (error: unknown) => {
        assert.ok(error instanceof AggregateError);
        assert.deepEqual(error.errors, [failure, cleanup]);
        return true;
      },
    );
    assert.equal(
      await fs.readFile(path.join(owner.root, "diagnostic"), "utf8"),
      "kept",
    );
  } finally {
    await owner.close();
  }
});

test("cancelling example preparation drains its real process before deleting resources", async () => {
  const controller = new AbortController();
  const owner = await createOwnedExample({ signal: controller.signal });
  const pending = owner.prepare((signal) =>
    owner.runner.run({
      argv: [
        process.execPath,
        "-e",
        'require("node:fs").writeFileSync("started", String(process.pid)); setInterval(() => {}, 1000);',
      ],
      cwd: owner.root,
      signal,
      env: Object.fromEntries(
        Object.entries(owner.environment).filter(
          (item): item is [string, string] => item[1] !== undefined,
        ),
      ),
    }),
  );
  const rejected = assert.rejects(pending, /stop preparation/u);
  try {
    let pid: number | undefined;
    const end = Date.now() + 5000;
    while (!pid && Date.now() < end) {
      pid = await fs
        .readFile(path.join(owner.root, "started"), "utf8")
        .then(Number, () => undefined);
      if (!pid) await pause(10);
    }
    assert.ok(pid, "The real command must start before cancellation");
    controller.abort(new Error("stop preparation"));
    await rejected;
    const closing = owner.close();
    assert.equal(owner.close(), closing);
    await closing;
    await assert.rejects(fs.access(owner.root), { code: "ENOENT" });
    if (process.platform !== "win32")
      assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
  } finally {
    controller.abort(new Error("stop preparation"));
    await owner.close();
  }
});

test("the preparation deadline cancels work without extending the fixture budget", async () => {
  const owner = await createOwnedExample({ timeoutMs: 20 });
  try {
    await assert.rejects(
      owner.prepare(
        (signal) =>
          new Promise<void>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason), {
              once: true,
            });
          }),
      ),
      /cancelled/u,
    );
  } finally {
    await owner.close();
  }
});
