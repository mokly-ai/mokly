import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import type { Metafile } from "esbuild";

import { moduleGraph } from "../packages/mokly/src/sidecar/bundle-graph.js";
import type { ModulePaths } from "../packages/mokly/src/sidecar/module-paths.js";

test("module graph converts each raw name once and keeps physical collision updates", () => {
  const root = path.resolve("graph-root");
  const entry = path.join(root, "entry.ts");
  const first = path.join(root, "first.ts");
  const second = path.join(root, "second.ts");
  const calls: string[] = [];
  const paths: Pick<ModulePaths, "sourceRoot" | "name"> = {
    sourceRoot: root,
    name(file) {
      calls.push(file);
      return file === entry ? "entry.ts" : "shared.ts";
    },
  };
  const metafile: Metafile = {
    inputs: {
      [first]: { bytes: 1, imports: [] },
      [second]: { bytes: 1, imports: [] },
      [entry]: {
        bytes: 1,
        imports: [first, second, first].map((file) => ({
          path: file,
          kind: "import-statement",
        })),
      },
    },
    outputs: {},
  };
  const graph = moduleGraph(metafile, paths);
  assert.deepEqual(graph.modules, [
    { path: "entry.ts", imports: ["shared.ts", "shared.ts", "shared.ts"] },
    { path: "shared.ts", imports: [] },
    { path: "shared.ts", imports: [] },
  ]);
  assert.deepEqual(
    [...graph.physical],
    [
      ["shared.ts", first],
      ["entry.ts", entry],
    ],
  );
  assert.deepEqual(calls, [first, second, entry]);
});

test("module graph converts the same metafile again after roots and names change", () => {
  const first = path.resolve("graph-first");
  const next = path.resolve("graph-next");
  let sourceRoot = first;
  let prefix = "first/";
  const paths: Pick<ModulePaths, "sourceRoot" | "name"> = {
    get sourceRoot() {
      return sourceRoot;
    },
    name: (file) => prefix + path.relative(paths.sourceRoot, file),
  };
  const metafile: Metafile = {
    inputs: { "entry.ts": { bytes: 1, imports: [] } },
    outputs: {},
  };
  const original = moduleGraph(metafile, paths);
  assert.deepEqual(original.modules, [{ path: "first/entry.ts", imports: [] }]);
  assert.deepEqual(
    [...original.physical],
    [["first/entry.ts", path.join(first, "entry.ts")]],
  );
  sourceRoot = next;
  prefix = "next/";
  const changed = moduleGraph(metafile, paths);
  assert.deepEqual(
    [...changed.physical],
    [["next/entry.ts", path.join(next, "entry.ts")]],
  );
  assert.deepEqual(changed.modules, [{ path: "next/entry.ts", imports: [] }]);
});
