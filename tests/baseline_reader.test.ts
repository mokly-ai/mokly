import assert from "node:assert/strict";
import test from "node:test";

import { RebuiltBaselineReader } from "../dist/baseline/reader.js";
import { MAX_BATCH_OUTPUT_BYTES } from "../dist/review/git_batch.js";

import { baselineCommit } from "./helpers/baseline_fixture.js";
import { MemoryBaselineFileSystem } from "./helpers/baseline_memory.js";

function fixture() {
  const fs = new MemoryBaselineFileSystem();
  fs.put("/repo/output", "directory");
  fs.put("/repo/output/mockups", "directory");
  return {
    fs,
    reader: new RebuiltBaselineReader(
      fs,
      "/repo",
      "/repo/output",
      baselineCommit,
      "mockups",
    ),
  };
}

test("rebuilt readers classify missing, directory, symlink and special files without following them", async () => {
  const { fs, reader } = fixture();
  const bytes = Buffer.from([0, 255, 127, 17]);
  fs.put("/repo/output/mockups/file", "regular", bytes);
  fs.put("/repo/output/mockups/dir", "directory");
  fs.put("/repo/output/mockups/link", "symlink");
  fs.put("/repo/output/mockups/device", "other");
  assert.deepEqual(
    Buffer.from(await reader.readFileBytes(baselineCommit, "mockups/file")),
    bytes,
  );
  assert.equal(
    await reader.fileExists(baselineCommit, "mockups/missing"),
    false,
  );
  const result = await reader.readFiles(baselineCommit, [
    "mockups/dir",
    "mockups/link",
    "mockups/device",
    "mockups/missing",
  ]);
  assert.deepEqual(
    [...result.values()],
    [
      { kind: "other" },
      { kind: "other" },
      { kind: "symlink" },
      { kind: "missing" },
    ],
  );
  for (const file of ["link", "link/target", "dir", "device"])
    await assert.rejects(
      reader.readFileBytes(baselineCommit, `mockups/${file}`),
      /regular baseline file/,
    );
});

for (const unsafe of [
  "../outside",
  "mockups/../outside",
  "other/file",
  "mockups/a\\b",
  "mockups/a\0b",
])
  test(`rebuilt readers reject unsafe path ${JSON.stringify(unsafe)}`, async () => {
    const { reader } = fixture();
    await assert.rejects(
      reader.readFileBytes(baselineCommit, unsafe),
      /baseline/,
    );
  });

test("rebuilt readers reject another commit and symlinks above the output root", async () => {
  const { fs, reader } = fixture();
  await assert.rejects(
    reader.readFileBytes("b".repeat(40), "mockups/file"),
    /commit/,
  );
  fs.put("/repo/cache", "symlink");
  fs.put("/repo/cache/entry", "directory");
  fs.put("/repo/cache/entry/output", "directory");
  fs.put("/repo/cache/entry/output/file", "regular");
  const linked = new RebuiltBaselineReader(
    fs,
    "/repo",
    "/repo/cache/entry/output",
    baselineCommit,
    "mockups",
  );
  assert.equal(
    await linked.fileKind(baselineCommit, "mockups/file"),
    "symlink",
  );
  await assert.rejects(
    linked.readFileBytes(baselineCommit, "mockups/file"),
    /symlink/,
  );
});

test("rebuilt reader rejects oversized objects before reading their bytes", async () => {
  const { fs, reader } = fixture();
  fs.put(
    "/repo/output/mockups/huge",
    "regular",
    Buffer.alloc(0),
    MAX_BATCH_OUTPUT_BYTES,
  );
  await assert.rejects(
    reader.readFiles(baselineCommit, ["mockups/huge"]),
    /too large.*bounded batch/,
  );
  assert.equal(fs.reads.length, 0);
});

test("rebuilt bulk reads deduplicate and bound filesystem concurrency across object batches", async () => {
  const { fs, reader } = fixture();
  const paths = Array.from(
    { length: 4100 },
    (_, index) => `mockups/file-${index}`,
  );
  for (const name of paths) fs.put(`/repo/output/${name}`, "regular");
  const read = fs.read.bind(fs);
  let active = 0;
  let maximum = 0;
  fs.read = async (...args) => {
    maximum = Math.max(maximum, ++active);
    const value = await read(...args);
    active--;
    return value;
  };
  assert.equal(
    (await reader.readFiles(baselineCommit, [...paths, ...paths])).size,
    paths.length,
  );
  assert.equal(fs.reads.length, paths.length);
  assert.ok(maximum > 1 && maximum <= 32);
});

test("rebuilt file inspection retains typed errors for filesystem failures", async () => {
  const { fs, reader } = fixture();
  fs.stat = async () => {
    throw new Error("Permission denied");
  };
  await assert.rejects(reader.fileExists(baselineCommit, "mockups/file"), {
    code: "baseline-output-invalid",
  });
});
