import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadConsumerGraph } from "../dist/build/load_graph.js";
import { loadConfig } from "../dist/config/load.js";
import { serve } from "../dist/server/serve.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { removeFixture } from "./helpers/fixture.js";
import { styleFixture } from "./helpers/imported_styles_fixture.js";

test("a reported graph source under mockups remains private through /static", async (t) => {
  const fixture = await changedFixture(
    t,
    undefined,
    { extraConfig: 'postcss: "postcss.config.mjs",' },
    async (candidate) => {
      await fs.writeFile(
        path.join(candidate.mockupsDir, "private.css"),
        ".private{color:red}",
      );
      await fs.appendFile(
        candidate.entryPath,
        '\nimport "../mockups/private.css";',
      );
      await fs.writeFile(
        path.join(candidate.root, "postcss.config.mjs"),
        `export default { plugins: [{ postcssPlugin: "reported-source", Once(root, { result }) {
          result.messages.push({ type: "dependency", plugin: "reported-source", file: new URL("./mockups/private.css", import.meta.url).pathname });
        } }] };`,
      );
    },
  );
  assert.ok(fixture.config.sourceFiles?.includes("mockups/private.css"));
  const running = await serve(fixture.config, { port: 0, watch: false });
  fixture.beforeRemove(() => running.close());
  assert.equal((await fetch(`${running.url}/static/private.css`)).status, 404);
});

test("directory dependency defaults to **/* and includes dotfiles", async (t) => {
  const fixture = await styleFixture(".x{color:red}", {
    extraConfig: 'postcss: "postcss.config.mjs",',
  });
  t.after(() => removeFixture(fixture));
  const sourceDirectory = path.join(fixture.root, "candidates");
  await fs.mkdir(path.join(sourceDirectory, "nested"), { recursive: true });
  await fs.writeFile(path.join(sourceDirectory, ".hidden.css"), "hidden");
  await fs.writeFile(path.join(sourceDirectory, "nested", "view.tsx"), "view");
  await fs.writeFile(
    path.join(fixture.root, "postcss.config.mjs"),
    `export default { plugins: [{ postcssPlugin: "default-glob", Once(root, { result }) {
      result.messages.push({ type: "dir-dependency", plugin: "default-glob", dir: new URL("./candidates", import.meta.url).pathname });
    } }] };`,
  );
  const graph = await loadConsumerGraph(await loadConfig(fixture.root), false);
  assert.ok(graph.sourceFiles.includes("candidates/.hidden.css"));
  assert.ok(graph.sourceFiles.includes("candidates/nested/view.tsx"));
  assert.deepEqual(graph.postcssWatchDirectories, [
    { directory: sourceDirectory, glob: "**/*" },
  ]);
});

test("directory dependency accepts an in-repository symlinked directory", async (t) => {
  const fixture = await styleFixture(".x{color:red}", {
    extraConfig: 'postcss: "postcss.config.mjs",',
  });
  t.after(() => removeFixture(fixture));
  const original = path.join(fixture.root, "authored");
  const alias = path.join(fixture.root, "candidates");
  await fs.mkdir(original);
  await fs.writeFile(path.join(original, "source.txt"), "candidate");
  await fs.symlink(original, alias, "dir");
  await fs.writeFile(
    path.join(fixture.root, "postcss.config.mjs"),
    `export default { plugins: [{ postcssPlugin: "aliased-dir", Once(root, { result }) {
      result.messages.push({ type: "dir-dependency", plugin: "aliased-dir", dir: new URL("./candidates", import.meta.url).pathname });
    } }] };`,
  );
  const graph = await loadConsumerGraph(await loadConfig(fixture.root), false);
  assert.ok(graph.sourceFiles.includes("authored/source.txt"));
  assert.ok(graph.sourceFiles.includes("candidates/source.txt"));
});

test("a symlink alias cannot hide a directory scan of generated output", async (t) => {
  const fixture = await styleFixture(".x{color:red}", {
    extraConfig: 'postcss: "postcss.config.mjs",',
  });
  t.after(() => removeFixture(fixture));
  const generated = path.join(fixture.mockupsDir, "mokly-generated/styles");
  await fs.mkdir(generated, { recursive: true });
  await fs.writeFile(path.join(generated, "stale.css"), ".stale{}");
  await fs.symlink(generated, path.join(fixture.root, "alias"), "dir");
  await fs.writeFile(
    path.join(fixture.root, "postcss.config.mjs"),
    `export default { plugins: [{ postcssPlugin: "aliased-output", Once(root, { result }) {
      result.messages.push({ type: "dir-dependency", plugin: "aliased-output", dir: new URL("./alias", import.meta.url).pathname });
    } }] };`,
  );
  await assert.rejects(
    loadConsumerGraph(await loadConfig(fixture.root), false),
    /PostCSS plugin aliased-output directory dependency scans Mokly-generated output in entries\/fixture\.css: alias\/stale\.css; exclude mockupsDir by excluding the matching scan root/,
  );
});

test("a symlink alias cannot make a public mockups file private", async (t) => {
  const fixture = await styleFixture(".x{color:red}", {
    extraConfig: 'postcss: "postcss.config.mjs",',
  });
  t.after(() => removeFixture(fixture));
  await fs.writeFile(path.join(fixture.mockupsDir, "public.css"), ".public{}");
  await fs.symlink(
    path.join(fixture.mockupsDir, "public.css"),
    path.join(fixture.root, "alias.css"),
  );
  await fs.writeFile(
    path.join(fixture.root, "postcss.config.mjs"),
    `export default { plugins: [{ postcssPlugin: "aliased-public", Once(root, { result }) {
      result.messages.push({ type: "dependency", plugin: "aliased-public", file: new URL("./alias.css", import.meta.url).pathname });
    } }] };`,
  );
  await assert.rejects(
    loadConsumerGraph(await loadConfig(fixture.root), false),
    /PostCSS plugin aliased-public scanned a public mockups file in entries\/fixture\.css: alias\.css; exclude mockupsDir from the plugin's sources/,
  );
});
