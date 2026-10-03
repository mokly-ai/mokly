import assert from "node:assert/strict";
import test from "node:test";

import { ensureBaselineDirectory } from "../dist/baseline/confinement.js";

import { MemoryBaselineFileSystem } from "./helpers/baseline_memory.js";

/** Memory filesystem whose cache root disappears once, as a lock release does. */
class VanishingCacheFileSystem extends MemoryBaselineFileSystem {
  vanished = 0;
  constructor(private readonly times: number) {
    super();
  }
  override async mkdir(directory: string): Promise<void> {
    if (
      directory === "/repo/.mokly-cache/baselines" &&
      this.vanished < this.times
    ) {
      this.vanished += 1;
      await this.remove("/repo/.mokly-cache");
      throw Object.assign(new Error(`ENOENT: mkdir ${directory}`), {
        code: "ENOENT",
      });
    }
    return super.mkdir(directory);
  }
}

test("baseline directory creation restarts when an empty cache root disappears", async () => {
  const fs = new VanishingCacheFileSystem(1);
  await ensureBaselineDirectory(
    fs,
    "/repo",
    "/repo/.mokly-cache/baselines/abc",
  );
  assert.equal(fs.vanished, 1);
  for (const directory of [
    "/repo/.mokly-cache",
    "/repo/.mokly-cache/baselines",
    "/repo/.mokly-cache/baselines/abc",
  ])
    assert.equal((await fs.stat(directory))?.kind, "directory", directory);
});

test("baseline directory creation stops retrying a parent that keeps disappearing", async () => {
  const fs = new VanishingCacheFileSystem(Number.POSITIVE_INFINITY);
  await assert.rejects(
    ensureBaselineDirectory(fs, "/repo", "/repo/.mokly-cache/baselines/abc"),
    { code: "ENOENT" },
  );
  assert.equal(fs.vanished, 5);
});
