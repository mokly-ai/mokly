import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { exampleSnapshotKey } from "../scripts/verification/example-snapshot-key.mjs";
import {
  produceExampleSnapshot,
  readSnapshotFile,
} from "../scripts/verification/example-snapshot.mjs";

import { assertSameCompilation } from "./helpers/compilation_equality.js";
import { repositoryRoot } from "./helpers/fixture.js";

test("the real example compilation survives the snapshot round trip", async (t) => {
  await fs.mkdir(path.join(repositoryRoot, ".context"), { recursive: true });
  const directory = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/example-snapshot-"),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "example-compilation.json");
  const key = () => exampleSnapshotKey(repositoryRoot);

  const produced = await produceExampleSnapshot({
    file,
    key,
    compile: async () =>
      compileCatalogue(
        await loadConfig(repositoryRoot, "examples/basic/mokly.config.ts"),
      ),
  });
  assert.equal(produced.status, "written");
  assert.equal(produced.status === "written" && produced.previous, "missing");

  const read = await readSnapshotFile(file, key);
  assert.equal(read.status, "fresh");
  if (read.status !== "fresh" || produced.status !== "written") return;
  assert.ok(produced.compilation.outputs.size > 400);
  assert.ok(
    [...produced.compilation.outputs.values()].some(
      (content) => typeof content !== "string",
    ),
    "the example must exercise binary outputs",
  );
  assertSameCompilation(read.compilation, produced.compilation);
  for (const [route, content] of produced.compilation.outputs)
    if (typeof content !== "string")
      assert.equal(
        read.compilation.outputs.get(route)?.constructor,
        content.constructor,
        route,
      );
});
