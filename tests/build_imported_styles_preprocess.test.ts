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
