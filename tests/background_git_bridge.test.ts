import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { MessageChannel, Worker } from "node:worker_threads";

import { BackgroundGitHost } from "../dist/server/demand/git_host.js";
import { WorkerGitCommandRunner } from "../dist/server/demand/git_worker.js";

import { blockingGit, processExists } from "./helpers/blocking_git.js";
import {
  createFixture,
  removeFixture,
  repositoryRoot,
} from "./helpers/fixture.js";

test("the Git bridge preserves concurrent text, binary input and command errors", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const { port1, port2 } = new MessageChannel();
  const host = new BackgroundGitHost(fixture.root, port1);
  const runner = new WorkerGitCommandRunner(port2);
  t.after(() => host.close());
  t.after(() => runner.close());
  await runner.run(["init", "-q"]);
  const input = Buffer.from([0, 255, 10, 128]);
  const expected = createHash("sha1")
    .update(`blob ${input.length}\0`)
    .update(input)
    .digest("hex");
  const [version, object] = await Promise.all([
    runner.run(["--version"]),
    runner.runBytesWithInput(["hash-object", "-w", "--stdin"], input),
  ]);
  assert.match(version, /^git version /);
  assert.equal(Buffer.from(object).toString().trim(), expected);
  assert.deepEqual(
    Buffer.from(await runner.runBytes(["cat-file", "blob", expected])),
    input,
  );
  await assert.rejects(
    runner.run(["mokly-invalid-command"]),
    /not a git command/,
  );
  await host.close();
  await new Promise<void>((resolve) => port2.once("close", resolve));
  await assert.rejects(runner.run(["--version"]), /stopped/);
});

test(
  "closing the Git host drains all active requests, including concurrent close callers",
  { timeout: 15000, skip: process.platform === "win32" },
  async (t) => {
    const fixture = await createFixture();
    t.after(() => removeFixture(fixture));
    const blocked = await blockingGit(fixture, true);
    const { port1, port2 } = new MessageChannel();
    const host = new BackgroundGitHost(fixture.root, port1);
    const runner = new WorkerGitCommandRunner(port2);
    t.after(() => host.close());
    t.after(() => runner.close());
    const requests = [1, 2].map(() =>
      assert.rejects(runner.run(["rev-parse", "--show-toplevel"]), /stopped/),
    );
    const firstPid = await blocked.started();
    const secondPid = await blocked.started(2);
    const closing = host.close();
    assert.equal(host.close(), closing);
    await closing;
    await Promise.all(requests);
    assert.equal(processExists(firstPid), false);
    assert.equal(processExists(secondPid), false);
  },
);

for (const action of ["block", "crash"] as const) {
  test(
    `Git can be drained when its requesting worker ${action === "block" ? "is unresponsive" : "crashes"}`,
    { timeout: 15000, skip: process.platform === "win32" },
    async (t) => {
      const fixture = await createFixture();
      t.after(() => removeFixture(fixture));
      const blocked = await blockingGit(fixture);
      const { port1, port2 } = new MessageChannel();
      const host = new BackgroundGitHost(fixture.root, port1);
      t.after(() => host.close());
      const worker = new Worker(
        `
        const { parentPort, workerData } = require("node:worker_threads");
        (async () => {
          const { WorkerGitCommandRunner } = await import(${JSON.stringify(pathToFileURL(path.join(repositoryRoot, "dist/server/demand/git_worker.js")).href)});
          const runner = new WorkerGitCommandRunner(workerData);
          void runner.run(["rev-parse", "--show-toplevel"]).catch(() => {});
          parentPort.once("message", (action) => {
            parentPort.postMessage("received");
            if (action === "block") { while (true) {} }
            throw new Error("worker failed");
          });
        })();
      `,
        { eval: true, workerData: port2, transferList: [port2], execArgv: [] },
      );
      worker.on("error", () => {});
      t.after(() => worker.terminate());
      const pid = await blocked.started();
      const received = new Promise((resolve) =>
        worker.once("message", resolve),
      );
      worker.postMessage(action);
      await received;
      if (action === "block") await host.close();
      else {
        for (let attempt = 0; attempt < 300 && processExists(pid); attempt++)
          await setTimeout(10);
      }
      assert.equal(processExists(pid), false);
    },
  );
}
