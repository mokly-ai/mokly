import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { Compilation } from "../dist/build/compile.js";
import { MANIFEST_NAME } from "../dist/registry/manifest.js";
import {
  decodeCompilation,
  encodeCompilation,
  produceExampleSnapshot,
  readSnapshotFile,
  writeExampleSnapshot,
} from "../scripts/verification/example-snapshot.mjs";

import { assertSameCompilation } from "./helpers/compilation_equality.js";
import { snapshotCompilation } from "./helpers/snapshot_compilation.js";

const KEY = "a".repeat(64);
const OTHER_KEY = "b".repeat(64);

function roundTrip(value: unknown): Compilation {
  return decodeCompilation(JSON.parse(JSON.stringify(value)));
}

async function directory(t: test.TestContext): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-snapshot-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test("a compilation survives the snapshot round trip exactly", () => {
  for (const withDocuments of [true, false]) {
    const expected = snapshotCompilation(withDocuments);
    const actual = roundTrip(encodeCompilation(expected, KEY));
    assertSameCompilation(actual, expected);
    assert.equal("documentMarkdown" in actual, withDocuments);
    assert.equal(typeof actual.outputs.get("styles.css"), "string");
    assert.equal(
      actual.outputs.get("mokly-generated/logo.png")?.constructor,
      Uint8Array,
    );
  }
});

test("encoding rejects a compilation field that the snapshot does not store", async (t) => {
  const extended = { ...snapshotCompilation(), assets: [] } as Compilation;
  assert.throws(
    () => encodeCompilation(extended, KEY),
    /cannot store compilation field assets/u,
  );
  const root = await directory(t);
  await assert.rejects(
    produceExampleSnapshot({
      file: path.join(root, "example-compilation.json"),
      key: async () => KEY,
      compile: async () => extended,
    }),
    /cannot store compilation field assets/u,
  );
  assert.deepEqual(await fs.readdir(root), []);
});

test("the equality assertion compares compilation field sets", () => {
  const expected = snapshotCompilation();
  const extended = { ...expected, assets: [] } as Compilation;
  for (const [actual, wanted] of [
    [extended, expected],
    [expected, extended],
  ] as const)
    assert.throws(
      () => assertSameCompilation(actual, wanted),
      /compilation fields differ/u,
    );
});

test("decoding rejects malformed snapshots", () => {
  const valid = () =>
    JSON.parse(JSON.stringify(encodeCompilation(snapshotCompilation(), KEY)));
  const cases: ReadonlyArray<
    readonly [string, (snapshot: Record<string, unknown>) => void, RegExp]
  > = [
    ["an older schema", (s) => (s.schemaVersion = 1), /schema version/u],
    ["another schema", (s) => (s.schemaVersion = 3), /schema version/u],
    ["a missing key", (s) => delete s.key, /key/u],
    ["a short key", (s) => (s.key = "abc"), /key/u],
    ["an uppercase key", (s) => (s.key = "A".repeat(64)), /key/u],
    ["an unknown field", (s) => (s.extra = true), /unexpected field extra/u],
    [
      "invalid base64",
      (s) => (s.outputs = [["logo.png", { kind: "bytes", base64: "@@@=" }]]),
      /output logo\.png/u,
    ],
    [
      "a duplicate route",
      (s) =>
        (s.outputs = [
          ["styles.css", "a"],
          ["styles.css", "b"],
        ]),
      /duplicate outputs entry styles\.css/u,
    ],
    ["outputs that are not pairs", (s) => (s.outputs = [["a"]]), /outputs/u],
    [
      "a non-string delivered style source",
      (s) => (s.deliveredStyleSources = [1]),
      /deliveredStyleSources/u,
    ],
    [
      "diagnostics that are not an array",
      (s) => (s.diagnostics = {}),
      /diagnostics/u,
    ],
    [
      "an unsupported diagnostic",
      (s) =>
        (s.diagnostics = [{ code: "other", route: "a.html", message: "m" }]),
      /diagnostic/u,
    ],
    [
      "a diagnostic with an extra field",
      (s) =>
        (s.diagnostics = [
          {
            code: "link-control-ancestor",
            route: "a.html",
            message: "m",
            extra: true,
          },
        ]),
      /diagnostics/u,
    ],
    [
      "a non-string document",
      (s) => (s.documentMarkdown = [["docs/guide.md", 1]]),
      /documentMarkdown/u,
    ],
  ];
  for (const [name, change, message] of cases) {
    const snapshot = valid();
    change(snapshot);
    assert.throws(() => decodeCompilation(snapshot), message, name);
  }
  for (const change of [
    (snapshot: Record<string, unknown>) =>
      ((snapshot.manifest as Record<string, unknown>).schemaVersion = 7),
    (snapshot: Record<string, unknown>) => (snapshot.manifest = []),
    (snapshot: Record<string, unknown>) =>
      (snapshot.outputs = (snapshot.outputs as [string, unknown][]).filter(
        ([route]) => route !== MANIFEST_NAME,
      )),
  ]) {
    const snapshot = valid();
    change(snapshot);
    assert.throws(
      () => decodeCompilation(snapshot),
      /manifest must serialize to the mokly-manifest\.json output/u,
    );
  }
  assert.throws(() => decodeCompilation([]), /JSON object/u);
});

test("writing replaces the snapshot atomically and leaves no temporary file", async (t) => {
  const root = await directory(t);
  const file = path.join(root, "nested/example-compilation.json");
  await writeExampleSnapshot(
    file,
    encodeCompilation(snapshotCompilation(), KEY),
  );
  await writeExampleSnapshot(
    file,
    encodeCompilation(snapshotCompilation(), OTHER_KEY),
  );
  assert.deepEqual(await fs.readdir(path.dirname(file)), [
    "example-compilation.json",
  ]);
  const written = JSON.parse(await fs.readFile(file, "utf8"));
  assert.equal(written.key, OTHER_KEY);

  const blocked = path.join(root, "blocked.json");
  await fs.mkdir(path.join(blocked, "occupied"), { recursive: true });
  await assert.rejects(
    writeExampleSnapshot(
      blocked,
      encodeCompilation(snapshotCompilation(), KEY),
    ),
  );
  assert.deepEqual((await fs.readdir(root)).sort(), ["blocked.json", "nested"]);
});

test("reading reports missing, invalid, stale and fresh snapshots", async (t) => {
  const root = await directory(t);
  const file = path.join(root, "example-compilation.json");
  let keyReads = 0;
  const key = async () => {
    keyReads += 1;
    return KEY;
  };
  assert.deepEqual(await readSnapshotFile(file, key), { status: "missing" });
  assert.equal(keyReads, 0);
  await fs.writeFile(file, "{ not json");
  assert.equal((await readSnapshotFile(file, key)).status, "invalid");
  await writeExampleSnapshot(
    file,
    encodeCompilation(snapshotCompilation(), OTHER_KEY),
  );
  assert.deepEqual(await readSnapshotFile(file, key), { status: "stale" });
  const broken = encodeCompilation(snapshotCompilation(), KEY);
  await writeExampleSnapshot(file, { ...broken, outputs: [["a", 1]] } as never);
  assert.equal((await readSnapshotFile(file, key)).status, "invalid");
  await writeExampleSnapshot(
    file,
    encodeCompilation(snapshotCompilation(), KEY),
  );
  const fresh = await readSnapshotFile(file, key);
  assert.equal(fresh.status, "fresh");
  assertSameCompilation(
    (fresh as { compilation: Compilation }).compilation,
    snapshotCompilation(),
  );
});

test("the producer compiles only when the snapshot is not fresh", async (t) => {
  const root = await directory(t);
  const file = path.join(root, "example-compilation.json");
  let key = KEY;
  let compiles = 0;
  const produce = () =>
    produceExampleSnapshot({
      file,
      key: async () => key,
      compile: async () => {
        compiles += 1;
        return snapshotCompilation();
      },
    });
  const written = await produce();
  assert.equal(written.status, "written");
  assert.equal(written.status === "written" && written.previous, "missing");
  assert.equal(compiles, 1);
  assert.deepEqual(await produce(), { status: "fresh" });
  assert.equal(compiles, 1);
  key = OTHER_KEY;
  const rewritten = await produce();
  assert.equal(rewritten.status === "written" && rewritten.previous, "stale");
  assert.equal(compiles, 2);
  assert.equal(JSON.parse(await fs.readFile(file, "utf8")).key, OTHER_KEY);
  await fs.writeFile(file, "[]");
  const repaired = await produce();
  assert.equal(repaired.status === "written" && repaired.previous, "invalid");
  assert.equal(compiles, 3);
  assert.equal((await readSnapshotFile(file, async () => key)).status, "fresh");
});

test("the producer refuses to write when an input changes during the compile", async (t) => {
  const root = await directory(t);
  const file = path.join(root, "example-compilation.json");
  const keys = [KEY, OTHER_KEY];
  await assert.rejects(
    produceExampleSnapshot({
      file,
      key: async () => keys.shift()!,
      compile: async () => snapshotCompilation(),
    }),
    /changed during the compile/u,
  );
  assert.deepEqual(await fs.readdir(root), []);
});
