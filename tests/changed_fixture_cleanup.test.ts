import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import type { TestContext } from "node:test";

import { changedFixture } from "./helpers/changed_fixture.js";
import { removeFixture } from "./helpers/fixture.js";

test("changed fixtures close their resources before deleting the working tree", async (t) => {
  let cleanup = async () => {};
  const context = {
    after(callback: () => Promise<void>) {
      cleanup = callback;
    },
  } as TestContext;
  const fixture = await changedFixture(context);
  t.after(() => removeFixture(fixture));
  const closed: string[] = [];
  fixture.onCleanup(async () => {
    await fs.access(fixture.entryPath);
    closed.push("server");
  });
  fixture.onCleanup(async () => {
    await fs.access(fixture.entryPath);
    closed.push("client");
  });

  await cleanup();

  assert.deepEqual(closed, ["client", "server"]);
  await assert.rejects(fs.access(fixture.root), { code: "ENOENT" });
});

test("changed fixture cleanup drains every resource and retains files on failure", async (t) => {
  let cleanup = async () => {};
  const context = {
    after(callback: () => Promise<void>) {
      cleanup = callback;
    },
  } as TestContext;
  const fixture = await changedFixture(context);
  t.after(() => removeFixture(fixture));
  let closed = false;
  fixture.onCleanup(async () => {
    await fs.access(fixture.entryPath);
    closed = true;
  });
  const failure = new Error("server could not stop");
  fixture.onCleanup(async () => {
    throw failure;
  });

  await assert.rejects(cleanup(), (error: unknown) => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [failure]);
    return true;
  });

  assert.equal(closed, true);
  await fs.access(fixture.entryPath);
});
