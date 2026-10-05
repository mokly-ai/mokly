import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { exportCatalogue } from "../dist/export/run.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { entryStyle } from "./helpers/imported_styles_fixture.js";

test("PostCSS watch metadata does not make a stable accepted generation fail export", async (t) => {
  const fixture = await changedFixture(
    t,
    undefined,
    { extraConfig: 'postcss: "postcss.config.mjs",' },
    async (candidate) => {
      await fs.writeFile(
        path.join(candidate.entriesDir, "fixture.css"),
        ".fixture{color:red}",
      );
      await fs.appendFile(candidate.entryPath, '\nimport "./fixture.css";');
      await fs.mkdir(path.join(candidate.root, "sources"));
      await fs.writeFile(
        path.join(candidate.root, "postcss.config.mjs"),
        `export default { plugins: [{ postcssPlugin: "watch-metadata", Once(root, { result }) {
          result.messages.push({ type: "dir-dependency", plugin: "watch-metadata", dir: new URL("./sources", import.meta.url).pathname });
        } }] };`,
      );
    },
  );
  const runtime = await prepareLiveRuntime(fixture.config);
  assert.deepEqual(runtime.config.postcssWatchDirectories, [
    { directory: path.join(fixture.root, "sources"), glob: "**/*" },
  ]);
  const result = await exportCatalogue(runtime.config, {
    outDir: "site",
    noChanges: true,
  });
  const exported = await fs.readFile(
    path.join(result.outDir, "static", entryStyle),
    "utf8",
  );
  assert.match(exported, /color: red/);
});
