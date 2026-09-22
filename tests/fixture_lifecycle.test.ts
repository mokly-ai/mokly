import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("fixture teardown drains dependents before removing their workspace", async (t) => {
  const fixture = await createFixture();
  t.after(() => fs.rm(fixture.root, { force: true, recursive: true }));
  const closed: string[] = [];
  fixture.beforeRemove(async () => {
    await fs.access(fixture.root);
    closed.push("outer");
  });
  fixture.beforeRemove(async () => {
    await fs.access(fixture.root);
    closed.push("inner");
  });

  await Promise.all([removeFixture(fixture), removeFixture(fixture)]);

  assert.deepEqual(closed, ["inner", "outer"]);
  await assert.rejects(fs.access(fixture.root), { code: "ENOENT" });
});

test("fixture teardown retains the workspace when a dependent cannot close", async (t) => {
  const fixture = await createFixture();
  t.after(() => fs.rm(fixture.root, { force: true, recursive: true }));
  fixture.beforeRemove(() => {
    throw new Error("dependent stayed open");
  });

  await assert.rejects(removeFixture(fixture), /dependent stayed open/);

  await fs.access(fixture.root);
});
