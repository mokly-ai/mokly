import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  normalizePlugin,
  parseCss,
  processCss,
  processRootSync,
} from "../dist/build/styles/postcss_calls.js";

import {
  brokenInlineMap,
  oversizedIndexedMap,
  unsupportedSiblingMap,
  withSourceMap,
} from "./helpers/source_map_comments.js";

const noop = { postcssPlugin: "mokly-noop", Once() {} };

async function mapCases(
  context: TestContext,
): Promise<readonly (readonly [css: string, from: string])[]> {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-postcss-calls-"),
  );
  context.after(() => fs.rm(directory, { force: true, recursive: true }));
  await fs.writeFile(path.join(directory, "card.map"), unsupportedSiblingMap);
  return [
    [withSourceMap(".card{color:red}", brokenInlineMap), "entries/card.css"],
    [
      withSourceMap(".card{color:red}", oversizedIndexedMap),
      "entries/card.css",
    ],
    [
      withSourceMap(".card{color:red}", "card.map"),
      path.join(directory, "card.css"),
    ],
  ];
}

test("parseCss never loads an inline or sibling source map", async (context) => {
  for (const [css, from] of await mapCases(context)) {
    const root = parseCss(css, from);
    assert.equal(root.source?.input.map, undefined, from);
    assert.equal(root.toString(), css);
  }
});

test("processCss never loads or writes a source map, with or without plugins", async (context) => {
  for (const plugins of [[], [noop]])
    for (const [css, from] of await mapCases(context)) {
      const result = await processCss(plugins, css, from);
      assert.equal(result.opts.map, false);
      assert.equal(result.map, undefined);
      assert.match(result.css, /\.card\{color:red\}/);
    }
});

test("processRootSync runs plugins over a parsed tree without source maps", () => {
  const css = withSourceMap(".card{color:red}", brokenInlineMap);
  const result = processRootSync(
    [noop],
    parseCss(css, "entries/card.css"),
    "entries/card.css",
  );
  assert.equal(result.opts.map, false);
  assert.equal(result.root.toString(), css);
});

test("normalizePlugin expands plugin creators and rejects other values", () => {
  const creator = Object.assign(() => noop, { postcss: true as const });
  assert.deepEqual(normalizePlugin(creator), [noop]);
  assert.throws(() => normalizePlugin(42 as never), /not a PostCSS plugin/);
});
