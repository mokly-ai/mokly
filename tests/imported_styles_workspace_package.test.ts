import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConsumerGraph } from "../dist/build/load_graph.js";
import { collectPostcssDependencies } from "../dist/build/styles/dependency_inventory.js";
import { loadConfig } from "../dist/config/load.js";
import { classifyWatchPath } from "../dist/server/watch_events.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("linked workspace-package CSS and image retain logical and physical source identities", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const packageRoot = path.join(fixture.root, "packages/ui");
  await fs.mkdir(packageRoot, { recursive: true });
  await fs.mkdir(path.join(fixture.root, "node_modules"));
  await fs.symlink(
    packageRoot,
    path.join(fixture.root, "node_modules/local-ui"),
  );
  await fs.writeFile(
    path.join(packageRoot, "styles.css"),
    '.badge{background:url("./image.png")}',
  );
  await fs.writeFile(
    path.join(packageRoot, "image.png"),
    Buffer.from([0, 255, 22]),
  );
  await fs.appendFile(
    fixture.entryPath,
    '\nimport "../node_modules/local-ui/styles.css";',
  );
  const config = await loadConfig(fixture.root);
  const compiled = await compileCatalogue(config);
  const graph = await loadConsumerGraph(config, false);
  const expected = ["packages/ui/styles.css", "packages/ui/image.png"];
  for (const file of expected) {
    assert.ok(compiled.manifest.sourceFiles.includes(file), file);
    assert.ok(graph.deliveredStyleSources.includes(file), file);
    assert.equal(
      classifyWatchPath(
        { path: path.join(fixture.root, file), kind: "change" },
        {
          ...config,
          sourceFiles: compiled.manifest.sourceFiles,
        },
      ),
      "rebuild",
    );
  }
  assert.deepEqual(
    Buffer.from(
      compiled.outputs.get(
        "mokly-generated/assets/node_modules/local-ui/image.png",
      ) as Uint8Array,
    ),
    Buffer.from([0, 255, 22]),
  );
  const reported = collectPostcssDependencies(
    config,
    [
      {
        type: "dependency",
        plugin: "workspace",
        source: path.join(fixture.entriesDir, "fixture.css"),
        file: path.join(fixture.root, "node_modules/local-ui/image.png"),
        malformed: false,
      },
    ],
    new Set(),
  );
  assert.ok(
    reported.sourceFiles.has(
      path.join(fixture.root, "node_modules/local-ui/image.png"),
    ),
  );
});

test("transformer-only workspace-package CSS inventories a linked image", async (context) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'compatibility: { transformer: "transform.ts" },',
  });
  context.after(() => removeFixture(fixture));
  const packageRoot = path.join(fixture.root, "packages/ui");
  await fs.mkdir(packageRoot, { recursive: true });
  await fs.mkdir(path.join(fixture.root, "node_modules"));
  await fs.symlink(
    packageRoot,
    path.join(fixture.root, "node_modules/local-ui"),
  );
  await fs.writeFile(
    path.join(packageRoot, "styles.css"),
    '.badge{background:url("./image.png")}',
  );
  await fs.writeFile(path.join(packageRoot, "image.png"), Buffer.from([22]));
  await fs.writeFile(
    path.join(fixture.root, "transform.ts"),
    'import "./node_modules/local-ui/styles.css"; export default ({ content }) => content;',
  );
  const compiled = await compileCatalogue(await loadConfig(fixture.root));
  assert.ok(compiled.manifest.sourceFiles.includes("packages/ui/image.png"));
});
