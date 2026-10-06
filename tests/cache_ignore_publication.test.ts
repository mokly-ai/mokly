import assert from "node:assert/strict";
import test from "node:test";

import { ensureCacheIgnore } from "../dist/config/cache_ignore.js";

import { baselineFixture, success } from "./helpers/baseline_fixture.js";
import { MemoryBaselineFileSystem } from "./helpers/baseline_memory.js";
import { CACHE_IGNORE_TEXT } from "./helpers/cache_ignore.js";

test("a baseline build that fails still leaves an ignored cache", async () => {
  const fixture = baselineFixture();
  fixture.runner.run = async () => ({
    ...success,
    exitCode: 1,
    output: "missing commit",
  });
  await assert.rejects(fixture.builder.build(fixture.request), {
    code: "baseline-history-unavailable",
  });
  const ignore = await fixture.fs.read("/repo/.mokly-cache/.gitignore", 1024);
  assert.equal(Buffer.from(ignore).toString("utf8"), CACHE_IGNORE_TEXT);
});

test("a failed publication removes its temporary file and reports the error", async () => {
  const files = new MemoryBaselineFileSystem();
  const failure = new Error("disk full");
  files.rename = async () => {
    throw failure;
  };
  await assert.rejects(ensureCacheIgnore(files, "/repo"), failure);
  assert.deepEqual(await files.list("/repo"), []);
});

test("a writer that loses the publication keeps the other writer's file", async () => {
  const files = new MemoryBaselineFileSystem();
  files.rename = async (_from, to) => {
    files.put(to, "regular", Buffer.from(CACHE_IGNORE_TEXT));
    throw new Error("busy");
  };
  await ensureCacheIgnore(files, "/repo");
  assert.deepEqual(await files.list("/repo"), [".gitignore"]);
});
