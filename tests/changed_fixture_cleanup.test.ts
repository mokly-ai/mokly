import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import type { TestContext } from "node:test";

import { changedFixture } from "./helpers/changed_fixture.js";

test("changed fixtures close their resources before deleting the working tree", async () => {
  let cleanup = async () => {};
  const context = {
    after(callback: () => Promise<void>) {
      cleanup = callback;
    },
  } as TestContext;
  const fixture = await changedFixture(context);
  try {
    const closed: string[] = [];
    fixture.beforeRemove(async () => {
      await fs.access(fixture.entryPath);
      closed.push("server");
    });
    fixture.beforeRemove(async () => {
      await fs.access(fixture.entryPath);
      closed.push("client");
    });

    await cleanup();

    assert.deepEqual(closed, ["client", "server"]);
    await assert.rejects(fs.access(fixture.root), { code: "ENOENT" });
  } finally {
    await fs.rm(fixture.root, { force: true, recursive: true });
  }
});

test("changed fixture cleanup drains every resource and retains files on failure", async () => {
  let cleanup = async () => {};
  const context = {
    after(callback: () => Promise<void>) {
      cleanup = callback;
    },
  } as TestContext;
  const fixture = await changedFixture(context);
  try {
    let closed = false;
    fixture.beforeRemove(async () => {
      await fs.access(fixture.entryPath);
      closed = true;
    });
    const failure = new Error("server could not stop");
    fixture.beforeRemove(async () => {
      throw failure;
    });

    await assert.rejects(cleanup(), (error: unknown) => error === failure);

    assert.equal(closed, true);
    await fs.access(fixture.entryPath);
  } finally {
    await fs.rm(fixture.root, { force: true, recursive: true });
  }
});
