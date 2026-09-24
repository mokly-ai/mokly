import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadConsumerGraph } from "../dist/build/load_graph.js";
import { loadConfig } from "../dist/config/load.js";
import { classifyWatchPath } from "../dist/server/watch_events.js";
import { watchTargets } from "../dist/server/watch_paths.js";

import { removeFixture } from "./helpers/fixture.js";
import { styleFixture } from "./helpers/imported_styles_fixture.js";

test("reported PostCSS directories watch only matching additions", async (t) => {
  const fixture = await styleFixture(".x{color:red}", {
    extraConfig: 'postcss: "postcss.config.mjs",',
  });
  t.after(() => removeFixture(fixture));
  const sources = path.join(fixture.root, "sources");
  await fs.mkdir(sources);
  await fs.writeFile(
    path.join(fixture.root, "postcss.config.mjs"),
    `export default { plugins: [{ postcssPlugin: "fixture-directory", Once(root, { result }) {
      result.messages.push({ type: "dir-dependency", plugin: "fixture-directory", dir: ${JSON.stringify(sources)}, glob: "**/*.txt" });
    } }] };`,
  );
  const config = await loadConfig(fixture.root);
  const graph = await loadConsumerGraph(config, false);
  config.sourceFiles = graph.sourceFiles;
  config.postcssWatchDirectories = graph.postcssWatchDirectories ?? [];
  assert.ok(watchTargets(config).includes(sources));
  assert.equal(
    classifyWatchPath(
      { path: path.join(sources, "new.txt"), kind: "add" },
      config,
    ),
    "rebuild",
  );
  assert.equal(
    classifyWatchPath(
      { path: path.join(sources, "new.css"), kind: "add" },
      config,
    ),
    "ignore",
  );
});

test("PostCSS directory watches never rebuild for deleted generated output", async (t) => {
  const fixture = await styleFixture(".x{color:red}");
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  config.postcssWatchDirectories = [
    { directory: fixture.root, glob: "**/*.css" },
  ];
  assert.equal(
    classifyWatchPath(
      {
        path: path.join(
          fixture.mockupsDir,
          "mokly-generated/styles/deleted.css",
        ),
        kind: "unlink",
      },
      config,
    ),
    "ignore",
  );
});

test("PostCSS watches ignore physical aliases to generated output and Review", async (t) => {
  const fixture = await styleFixture(".x{color:red}");
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const generated = path.join(fixture.mockupsDir, "mokly-generated/styles");
  const review = path.join(fixture.root, ".review");
  await fs.mkdir(generated, { recursive: true });
  await fs.mkdir(review);
  for (const [name, target] of [
    ["generated-alias", generated],
    ["review-alias", review],
  ] as const) {
    const alias = path.join(fixture.root, name);
    await fs.symlink(target, alias, "dir");
    config.postcssWatchDirectories = [
      { directory: fixture.root, glob: "**/*" },
    ];
    assert.equal(
      classifyWatchPath(
        { path: path.join(alias, "new.css"), kind: "add" },
        config,
      ),
      "ignore",
    );
  }
});
