import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { validateGeneratedOutputPaths } from "../dist/build/output_paths.js";
import { isAuthoringSource } from "../dist/build/source_inventory.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { startCatalogueServer } from "../dist/server/http.js";
import { classifyWatchPath } from "../dist/server/watch_events.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";
import {
  excludedNames,
  permittedNames,
  writeExclusionFiles,
} from "./helpers/public_exclusions.js";

test("Serve exposes only referenced assets, including for HEAD", async (context) => {
  const fixture = await createFixture(undefined, {
    extraConfig:
      'stylesheets: [{ match: "**/*", stylesheets: ["styles.css"] }],',
  });
  context.after(() => removeFixture(fixture));
  await writeExclusionFiles(fixture.mockupsDir);
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  assert.ok(compilation.manifest.assetClosure.includes("styles.css"));
  await writeCompilation(compilation, config);
  const server = await startCatalogueServer(config, { base: "main", port: 0 });
  fixture.beforeRemove(() => server.close());
  for (const name of [
    ...excludedNames,
    ...permittedNames.filter((name) => name !== "styles.css"),
  ])
    for (const method of ["GET", "HEAD"])
      assert.equal(
        (await fetch(`${server.url}/static/${name}`, { method })).status,
        404,
        `${method} ${name}`,
      );
  for (const method of ["GET", "HEAD"])
    assert.equal(
      (await fetch(`${server.url}/static/styles.css`, { method })).status,
      200,
    );
});

test("source protection recognizes reserved files and aliases", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  await writeExclusionFiles(fixture.mockupsDir);
  await fs.writeFile(
    path.join(fixture.mockupsDir, "private.source.html"),
    "private",
  );
  await fs.symlink(
    "private.source.html",
    path.join(fixture.mockupsDir, "alias.txt"),
  );
  const config = await loadConfig(fixture.root);
  for (const name of ["private.source.html", "alias.txt"])
    assert.ok(
      isAuthoringSource(path.join(config.mockupsDir, name), config),
      name,
    );
  for (const name of [...permittedNames, "README.md", "tsconfig.json"])
    assert.equal(
      isAuthoringSource(path.join(config.mockupsDir, name), config),
      undefined,
      name,
    );
});

test("generated routes may have names formerly reserved by the public directory policy", async (context) => {
  const fixture = await createFixture(
    `import { definePage } from "@mokly/mokly"; export const mockups = [definePage({ id: "page", title: "Page", description: "Page", dependencies: [], relatedDocs: [], route: "internal/page.html", render: () => "<!doctype html><html><body><p>Page</p></body></html>" })];`,
  );
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  assert.ok((await compileCatalogue(config)).outputs.has("internal/page.html"));
});

test("a reference to protected authored HTML fails with its referring route", async (context) => {
  const fixture = await createFixture(
    validEntrySource({
      body: '<iframe src="../../private.source.html" title="Private" />',
    }),
  );
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.mockupsDir, "private.source.html"),
    "<p>Private</p>",
  );
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    (error: Error) => {
      assert.match(error.message, /screens\/home/);
      assert.match(error.message, /private.source.html/);
      return true;
    },
  );
});

test("an imported JSON input remains watched, not public by directory membership", async (context) => {
  const fixture = await createFixture(
    `${validEntrySource()}\nimport settings from "../mockups/tsconfig.fixture.json"; mockups[1].title = settings.title;`,
    {
      extraConfig:
        'watch: { rules: [{ paths: ["mockups/tsconfig.fixture.json"], action: "rebuild" }] },',
    },
  );
  context.after(() => removeFixture(fixture));
  const settings = path.join(fixture.mockupsDir, "tsconfig.fixture.json");
  await fs.writeFile(settings, '{"title":"Before"}');
  const config = await loadConfig(fixture.root);
  assert.ok(
    (await compileCatalogue(config)).manifest.sourceFiles.includes(
      "mockups/tsconfig.fixture.json",
    ),
  );
  await fs.writeFile(settings, '{"title":"After"}');
  assert.equal(
    classifyWatchPath({ path: settings, kind: "change" }, config),
    "rebuild",
  );
  assert.equal(
    (await compileCatalogue(config)).manifest.entries.find(
      (entry) => entry.id === "home",
    )?.title,
    "After",
  );
});

test("canonical builder metadata remains writable but private", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  assert.doesNotThrow(() =>
    validateGeneratedOutputPaths(["mokly-manifest.json"], config),
  );
  assert.ok(
    isAuthoringSource(
      path.join(config.generatedDir, "mokly-manifest.json"),
      config,
    ),
  );
});

test("explicit watch actions remain effective", async (context) => {
  const fixture = await createFixture(undefined, {
    extraConfig:
      'watch: { rules: [{ paths: ["mockups/README.md"], action: "rebuild" }] },',
  });
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  assert.equal(
    classifyWatchPath(
      { path: path.join(fixture.mockupsDir, "README.md"), kind: "change" },
      config,
    ),
    "rebuild",
  );
});
