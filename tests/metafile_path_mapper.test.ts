import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import test from "node:test";

import type { Metafile } from "esbuild";

import { createMetafilePathMapper } from "../dist/build/metafile_paths.js";
import { graphSourceFiles } from "../dist/build/source_inventory.js";
import { orderedStyles } from "../dist/build/styles/order.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { countingMetafileMapper } from "./helpers/metafile_work.js";

test("one metafile mapper keeps a symlinked working directory's logical paths", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const alias = `${fixture.root}-alias`;
  await fs.symlink(fixture.root, alias, "dir");
  context.after(() => fs.rm(alias));
  const mapper = createMetafilePathMapper(alias);
  const logical = path.join(alias, "entries/fixture.mockup.tsx");
  assert.equal(mapper.path(mapper.key(logical)), logical);
});

test("large ordered CSS inventory maps each path once", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const root = "entries/fixture.mockup.tsx";
  const files = Array.from(
    { length: 10_000 },
    (_, index) => `entries/css-${index}.css`,
  );
  const metafile: Metafile = {
    inputs: {
      [root]: {
        bytes: 1,
        imports: files.map((file) => ({
          path: file,
          kind: "import-statement",
        })),
      },
      ...Object.fromEntries(
        files.map((file) => [file, { bytes: 1, imports: [] }]),
      ),
    },
    outputs: {},
  };
  const { counts, mapper } = countingMetafileMapper(fixture.root);
  const started = performance.now();
  const ordered = orderedStyles(
    metafile,
    path.join(fixture.root, root),
    fixture.root,
    new Set(),
    mapper,
  );
  const elapsed = performance.now() - started;
  assert.equal(ordered.length, files.length);
  context.diagnostic(`10,000 graph edges took ${elapsed.toFixed(1)} ms`);
  assert.deepEqual(counts, { keys: 1, paths: files.length });
});

test("large graph source inventory reuses one mapped working directory", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const directory = path.join(fixture.root, "sources");
  await fs.mkdir(directory);
  const files = Array.from(
    { length: 3_000 },
    (_, index) => `sources/input-${index}.ts`,
  );
  for (let start = 0; start < files.length; start += 250)
    await Promise.all(
      files
        .slice(start, start + 250)
        .map((file) =>
          fs.writeFile(path.join(fixture.root, file), "export default null;"),
        ),
    );
  const metafile: Metafile = {
    inputs: Object.fromEntries(
      files.map((file) => [file, { bytes: 20, imports: [] }]),
    ),
    outputs: {},
  };
  const { counts, mapper } = countingMetafileMapper(fixture.root);
  const started = performance.now();
  const inventory = graphSourceFiles(
    metafile,
    fixture.root,
    fixture.root,
    fixture.mockupsDir,
    mapper,
  );
  const elapsed = performance.now() - started;
  context.diagnostic(`3,000 graph inputs: ${elapsed.toFixed(1)} ms`);
  assert.equal(inventory.length, files.length);
  assert.deepEqual(counts, { keys: 0, paths: files.length });
});
