import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { NodeBaselineFileSystem } from "../packages/mokly/dist/baseline/filesystem.js";
import type { BaselineMaintenanceFailure } from "../packages/mokly/dist/baseline/maintenance.js";

for (const publication of ["acquired", "occupied", "failed"] as const) {
  test(`temporary cleanup preserves the ${publication} lock publication outcome`, async (t) => {
    const failures: BaselineMaintenanceFailure[] = [];
    const filesystem = new NodeBaselineFileSystem({
      report: (failure) => failures.push(failure),
    });
    const cleanupError = Object.assign(new Error("cleanup denied"), {
      code: "EACCES",
    });
    const publicationError = Object.assign(new Error("publication denied"), {
      code: publication === "occupied" ? "EEXIST" : "EPERM",
    });
    t.mock.method(filesystem, "write", async () => {});
    t.mock.method(filesystem, "stat", async () => ({
      kind: "regular",
      size: 5,
      identity: "owned",
    }));
    t.mock.method(fs, "link", async () => {
      if (publication !== "acquired") throw publicationError;
    });
    t.mock.method(filesystem, "remove", async () => {
      throw cleanupError;
    });
    const acquired = filesystem.acquireLock(
      "/cache/commit/lock",
      Buffer.from("owner"),
    );
    if (publication === "failed")
      await assert.rejects(acquired, (error) => error === publicationError);
    else
      assert.deepEqual(
        await acquired,
        publication === "acquired" ? { identity: "owned" } : undefined,
      );
    assert.equal(failures.length, 1);
    assert.equal(failures[0]!.error, cleanupError);
    assert.match(failures[0]!.entry, /\.lock-\d+-[\da-f-]+$/);
  });
}

test("a failed temporary cleanup does not strand ownership or overwrite another lock", async (t) => {
  const filesystem = new NodeBaselineFileSystem({ report() {} });
  let locked = false;
  t.mock.method(filesystem, "write", async () => {});
  t.mock.method(filesystem, "stat", async () => ({
    kind: "regular",
    size: 1,
    identity: "owned",
  }));
  t.mock.method(fs, "link", async () => {
    if (locked) throw Object.assign(new Error("locked"), { code: "EEXIST" });
    locked = true;
  });
  t.mock.method(filesystem, "remove", async (file: string) => {
    if (file.endsWith("/lock")) locked = false;
    else throw new Error("temporary unavailable");
  });
  assert.deepEqual(
    await filesystem.acquireLock("/cache/lock", Buffer.from("a")),
    { identity: "owned" },
  );
  assert.equal(
    await filesystem.acquireLock("/cache/lock", Buffer.from("b")),
    undefined,
  );
  await filesystem.remove("/cache/lock");
  assert.deepEqual(
    await filesystem.acquireLock("/cache/lock", Buffer.from("c")),
    { identity: "owned" },
  );
});

test("a metadata failure happens before publication and still removes the temporary file", async (t) => {
  const filesystem = new NodeBaselineFileSystem({ report() {} });
  t.mock.method(filesystem, "write", async () => {});
  t.mock.method(filesystem, "stat", async () => {
    throw new Error("metadata unavailable");
  });
  const link = t.mock.method(fs, "link", async () => {});
  const remove = t.mock.method(filesystem, "remove", async () => {});
  await assert.rejects(
    filesystem.acquireLock("/cache/lock", Buffer.from("a")),
    /metadata unavailable/,
  );
  assert.equal(link.mock.calls.length, 0);
  assert.equal(remove.mock.calls.length, 1);
});
