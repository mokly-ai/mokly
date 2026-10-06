import assert from "node:assert/strict";
import test from "node:test";

import { SelectedAssetReader } from "../packages/mokly/dist/review/evidence_assets.js";

test("resource hints can use filenames inherited by ordinary IPC objects", async () => {
  let reads = 0;
  const reader = new SelectedAssetReader(
    {
      async read() {
        reads++;
        return Buffer.from("image bytes");
      },
    },
    new AbortController().signal,
    JSON.parse("{}") as Record<string, string>,
  );
  assert.equal(
    Buffer.from(await reader.read("constructor")).toString(),
    "image bytes",
  );
  await reader.read("constructor");
  assert.equal(reads, 1);
});

test("a cancelled snapshot never accepts a completed resource read", async () => {
  const controller = new AbortController();
  const reader = new SelectedAssetReader(
    {
      async read() {
        controller.abort();
        return Buffer.from("late bytes");
      },
    },
    controller.signal,
  );
  await assert.rejects(reader.read("image.svg"), { name: "AbortError" });
});

test("optional counterpart reads bypass a strict-only bulk reader", async () => {
  const reads: string[] = [];
  const reader = new SelectedAssetReader(
    {
      async read() {
        throw new Error("Strict single read must not run");
      },
      async readMany() {
        throw new Error("Strict batch rejects a missing CSS counterpart");
      },
      async readIfExists(route) {
        reads.push(route);
        return route === "present.css" ? Buffer.from(".auth {}") : undefined;
      },
    },
    new AbortController().signal,
  );
  const expected = new Map([
    ["present.css", Buffer.from(".auth {}")],
    ["missing.css", undefined],
  ]);
  assert.deepEqual(
    await reader.readManyIfExists([...expected.keys()]),
    expected,
  );
  assert.deepEqual(
    await reader.readManyIfExists([...expected.keys()]),
    expected,
  );
  assert.deepEqual(reads, [...expected.keys()]);
  await assert.rejects(
    reader.readMany(["missing.css"]),
    /Snapshot file is missing/,
  );
});
