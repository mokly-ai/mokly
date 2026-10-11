import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { normalizeBuildDiagnostics } from "../dist/build/build_warnings.js";
import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { exampleSnapshotKey } from "../scripts/verification/example-snapshot-key.mjs";
import {
  decodeCompilation,
  encodeCompilation,
  produceExampleSnapshot,
  readSnapshotFile,
} from "../scripts/verification/example-snapshot.mjs";

import { assertSameCompilation } from "./helpers/compilation_equality.js";
import { loadExampleCompilation } from "./helpers/example_compilation.js";
import { repositoryRoot } from "./helpers/fixture.js";
import { snapshotCompilation } from "./helpers/snapshot_compilation.js";

const KEY = "a".repeat(64);
const seeds = [
  { path: "styles/z.css", sourceRoute: "home/index.html" },
  { path: "styles/a.css", sourceRoute: "about/index.html" },
  { path: "styles/z.css", sourceRoute: "home/index.html" },
];

test("resource seeds survive the snapshot round trip in compilation order", () => {
  for (const resourceSeeds of [undefined, [], seeds]) {
    const expected = {
      ...snapshotCompilation(),
      ...(resourceSeeds === undefined ? {} : { resourceSeeds }),
    };
    const encoded = encodeCompilation(expected, KEY);
    const actual = decodeCompilation(JSON.parse(JSON.stringify(encoded)));
    assert.equal("resourceSeeds" in encoded, resourceSeeds !== undefined);
    assert.equal("resourceSeeds" in actual, resourceSeeds !== undefined);
    assert.deepEqual(actual.resourceSeeds, resourceSeeds);
    assertSameCompilation(actual, expected);
  }
});

test("route and subject diagnostics survive the snapshot round trip", () => {
  const expected = snapshotCompilation();
  expected.diagnostics = normalizeBuildDiagnostics([
    ...expected.diagnostics,
    {
      code: "removed-shared-impact",
      message: "Ignored input.",
      subject: { kind: "configuration", path: "mokly.config.ts" },
    },
    {
      code: "duplicate-component-stylesheet",
      message: "Repeated stylesheet.",
      subject: { kind: "component", path: "action" },
    },
    {
      code: "removed-dependencies",
      message: "Ignored input.",
      subject: { kind: "entry", path: "home" },
    },
    {
      code: "removed-dependencies",
      message: "Ignored input.",
      subject: { kind: "folder", path: "" },
    },
  ]);
  const encoded = {
    ...encodeCompilation(expected, KEY),
    diagnostics: [...expected.diagnostics]
      .reverse()
      .concat(expected.diagnostics),
  };
  const actual = decodeCompilation(JSON.parse(JSON.stringify(encoded)));
  assertSameCompilation(actual, expected);
});

test("a snapshot with resource seeds and subject warnings stays fresh", async (t) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-snapshot-forms-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, "example-compilation.json");
  const expected = {
    ...snapshotCompilation(),
    resourceSeeds: seeds,
    diagnostics: normalizeBuildDiagnostics([
      {
        code: "removed-shared-impact",
        message: "Ignored input.",
        subject: { kind: "configuration", path: "mokly.config.ts" },
      },
    ]),
  };
  let compiles = 0;
  const compile = async () => {
    compiles += 1;
    return expected;
  };
  const key = async () => KEY;
  const produce = () => produceExampleSnapshot({ file, key, compile });
  assert.equal((await produce()).status, "written");
  assert.deepEqual(await produce(), { status: "fresh" });
  const loaded = await loadExampleCompilation({
    read: () => readSnapshotFile(file, key),
    compile,
    write: () => {},
  });
  assertSameCompilation(loaded, expected);
  assert.equal(compiles, 1);
});

test("resource seed validation rejects malformed records", () => {
  for (const resourceSeeds of [
    null,
    {},
    [null],
    [{}],
    [{ path: 1, sourceRoute: "home/index.html" }],
    [{ path: "styles.css", sourceRoute: 1 }],
    [{ path: "styles.css", sourceRoute: "home/index.html", extra: true }],
  ]) {
    assert.throws(
      () =>
        encodeCompilation(
          { ...snapshotCompilation(), resourceSeeds } as never,
          KEY,
        ),
      /resourceSeeds/u,
    );
    assert.throws(
      () =>
        decodeCompilation({
          ...encodeCompilation(snapshotCompilation(), KEY),
          resourceSeeds,
        }),
      /resourceSeeds/u,
    );
  }
});

test("subject diagnostics use the build warning validation rules", () => {
  const diagnostic = {
    code: "removed-shared-impact",
    message: "Ignored input.",
    subject: { kind: "configuration", path: "mokly.config.ts" },
  };
  for (const invalid of [
    { ...diagnostic, route: "home/index.html" },
    { ...diagnostic, subject: { kind: "other", path: "mokly.config.ts" } },
    {
      ...diagnostic,
      subject: { kind: "configuration", path: "../outside.ts" },
    },
    { ...diagnostic, subject: { ...diagnostic.subject, extra: true } },
    { ...diagnostic, message: "invalid\nmessage" },
  ])
    assert.throws(
      () =>
        decodeCompilation({
          ...encodeCompilation(snapshotCompilation(), KEY),
          diagnostics: [invalid],
        }),
      /diagnostics/u,
    );
});

test("the equality assertion compares resource seed values and order", () => {
  const expected = { ...snapshotCompilation(), resourceSeeds: seeds };
  for (const resourceSeeds of [
    [],
    seeds.slice(0, 2),
    [...seeds].sort((a, b) => a.path.localeCompare(b.path)),
  ])
    assert.throws(() =>
      assertSameCompilation({ ...expected, resourceSeeds }, expected),
    );
});

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
