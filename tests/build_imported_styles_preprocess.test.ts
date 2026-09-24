import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  StylePreprocessor,
  type StyleTextProcessor,
} from "../dist/build/styles/preprocess.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("CSS preprocessing prunes before plugins, memoizes effective inputs and reports sources", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const source = path.join(fixture.entriesDir, "fixture.css");
  const removed = path.join(fixture.entriesDir, "renderer.css");
  await fs.writeFile(source, '@import "./renderer.css"; .entry{color:red}');
  const visited: string[] = [];
  const processor: StyleTextProcessor = {
    async process(_source, text) {
      visited.push(text);
      return {
        css: `${text}\n.processed{color:blue}`,
        sourceFiles: [fixture.configPath],
      };
    },
  };
  const preprocessor = new StylePreprocessor(
    await loadConfig(fixture.root),
    processor,
  );
  const excluded = new Set([removed]);
  const resolveImport = async () => removed;
  const first = await preprocessor.prepare(source, excluded, resolveImport);
  assert.doesNotMatch(visited[0]!, /@import/);
  assert.match(first.css, /\.processed/);
  await preprocessor.prepare(source, new Set([removed]), resolveImport);
  assert.equal(visited.length, 1);
  await preprocessor.prepare(source);
  assert.equal(visited.length, 2);
  assert.deepEqual([...preprocessor.sourceFiles], [fixture.configPath]);
});

test("unaffected stylesheet shares its processed result across renderer exclusions", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const source = path.join(fixture.entriesDir, "card.module.css");
  const shared = path.join(fixture.entriesDir, "shared.css");
  const unrelated = path.join(fixture.entriesDir, "unrelated.css");
  await fs.writeFile(source, '@import "./shared.css"; .card{color:red}');
  const visited: string[] = [];
  const processor: StyleTextProcessor = {
    async process(_source, text) {
      visited.push(text);
      return { css: text, sourceFiles: [] };
    },
  };
  const preprocessor = new StylePreprocessor(
    await loadConfig(fixture.root),
    processor,
  );
  const resolveImport = async () => shared;
  await preprocessor.prepare(source);
  await preprocessor.prepare(source, new Set([unrelated]), resolveImport);
  assert.equal(visited.length, 1);
  await preprocessor.prepare(
    source,
    new Set([shared, unrelated]),
    resolveImport,
  );
  assert.equal(visited.length, 2);
  await preprocessor.prepare(source, new Set([shared]), resolveImport);
  assert.equal(visited.length, 2);
});
