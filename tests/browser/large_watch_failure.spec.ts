import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { benchmark } from "../../scripts/large/benchmark.js";
import { prepareFixture } from "../../scripts/large/setup.js";
import { fixtureEdits } from "../../scripts/large/watch_edits.js";
import { repositoryRoot } from "../helpers/fixture.js";

import { test } from "./browser_test.js";

const run = promisify(execFile);
function signal() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("failed watch waits for restoration and closes only its context", async ({
  browser,
}) => {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/large-watch-failure-"),
  );
  const fixture = await prepareFixture(
    repositoryRoot,
    { areas: 1, screens: 2, rows: 1, stylesheets: 1 },
    "html",
    "workspace",
    root,
  );
  const [edit] = await fixtureEdits(fixture);
  assert.ok(edit);
  const callerContext = await browser.newContext();
  const contexts = new Set(browser.contexts());
  const restoring = signal(),
    release = signal();
  const write = fs.writeFile;
  let stopped = false,
    settled = false;
  fs.writeFile = async (...args) => {
    if (stopped && args[0] === edit.file && args[1] === edit.original) {
      restoring.resolve();
      await release.promise;
    }
    await write(...args);
    if (!stopped && args[0] === edit.file && args[1] === edit.changed) {
      stopped = true;
      const { stdout } = await run("ps", ["-eo", "pid=,args="]);
      const prefix = `${process.execPath} ${root}/node_modules/@mokly/mokly/bin/mokly.mjs serve `;
      const owned = stdout
        .split("\n")
        .map((line) => line.trim().match(/^(\d+) (.*)$/))
        .find((row) => row?.[2]?.startsWith(prefix));
      assert.ok(owned, "The fixture's owned shim must exist");
      process.kill(-Number(owned[1]), "SIGTERM");
    }
  };
  const result = benchmark(fixture, ["watch"], 1, { memoryStopKiB: 0, browser })
    .then(
      () => ({ error: undefined }),
      (error: unknown) => ({ error }),
    )
    .finally(() => {
      settled = true;
    });
  try {
    const first = await Promise.race([
      restoring.promise.then(() => "restoring"),
      result.then(() => "returned"),
    ]);
    assert.equal(first, "restoring");
    assert.equal(settled, false);
    assert.equal(await fs.readFile(edit.file, "utf8"), edit.changed);
    release.resolve();
    const outcome = await result;
    assert.match(
      String(outcome.error),
      /Serve stopped before browser verification/,
    );
    assert.equal(await fs.readFile(edit.file, "utf8"), edit.original);
    assert.deepEqual(new Set(browser.contexts()), contexts);
    assert.equal(browser.isConnected(), true);
  } finally {
    release.resolve();
    await Promise.all(
      browser
        .contexts()
        .filter((context) => !contexts.has(context))
        .map((context) => context.close()),
    );
    await result;
    fs.writeFile = write;
    await callerContext.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
