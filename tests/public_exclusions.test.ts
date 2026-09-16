import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { validateGeneratedOutputPaths } from "../dist/build/output_paths.js";
import { isOwned } from "../dist/build/ownership.js";
import { isAuthoringSource } from "../dist/build/source_inventory.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { isPublicStaticFile } from "../dist/config/public_files.js";
import { FileSystemReviewAssetReader } from "../dist/review/assets.js";
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

test("Serve GET and HEAD and Review deny public exclusions while ordinary assets remain public", async (t) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'publicExclude: ["internal/**"],',
  });
  t.after(() => removeFixture(fixture));
  await writeExclusionFiles(fixture.mockupsDir);
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  const server = await startCatalogueServer(config, { base: "main", port: 0 });
  t.after(() => server.close());
  const reader = new FileSystemReviewAssetReader(config);
  for (const name of excludedNames) {
    for (const method of ["GET", "HEAD"])
      assert.equal(
        (await fetch(`${server.url}/static/${name}`, { method })).status,
        404,
        `${method} ${name}`,
      );
    await assert.rejects(reader.read(name), /not a public static file/);
  }
  for (const name of permittedNames) {
    assert.equal(
      isPublicStaticFile(path.join(fixture.mockupsDir, name), config),
      true,
      name,
    );
    assert.equal(
      (await fetch(`${server.url}/static/${name}`)).status,
      200,
      name,
    );
  }
});

test("source policy matches both aliases and projects missing children relative to the mockups root", async (t) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'publicExclude: ["INTERNAL/**"],',
  });
  t.after(() => removeFixture(fixture));
  await writeExclusionFiles(fixture.mockupsDir);
  await fs.symlink("README.md", path.join(fixture.mockupsDir, "alias.txt"));
  await fs.symlink("internal", path.join(fixture.mockupsDir, "visible"));
  await fs.symlink("data.json", path.join(fixture.mockupsDir, "README.json"));
  await fs.symlink("mockups", path.join(fixture.root, "generated"));
  const config = {
    ...(await loadConfig(fixture.root)),
    mockupsDir: path.join(fixture.root, "generated"),
  };
  for (const name of [
    "alias.txt",
    "visible/private.json",
    "visible/deleted.json",
    "README.json",
    ...excludedNames,
  ])
    assert.ok(
      isAuthoringSource(path.join(config.mockupsDir, name), config),
      name,
    );
  for (const name of permittedNames)
    assert.equal(
      isAuthoringSource(path.join(config.mockupsDir, name), config),
      undefined,
      name,
    );
});

for (const route of ["README.html", "internal/page.html"]) {
  test(`build rejects excluded generated route ${route} before writing`, async (t) => {
    const fixture = await createFixture(
      `import { definePage } from "@mokly/mokly"; export const mockups = [definePage({ id: "page", title: "Page", description: "Page", dependencies: [], relatedDocs: [], route: "${route}", render: () => "<!doctype html><html><body><p>Page</p></body></html>" })];`,
      { extraConfig: 'publicExclude: ["internal/**"],' },
    );
    t.after(() => removeFixture(fixture));
    await assert.rejects(
      compileCatalogue(await loadConfig(fixture.root)),
      (error: Error) => {
        assert.match(error.message, /matches public exclusion.*publicExclude/);
        assert.ok(error.message.includes(route));
        assert.ok(
          error.message.includes(
            route === "README.html" ? "**/README.*" : "internal/**",
          ),
        );
        return true;
      },
    );
    await assert.rejects(fs.stat(path.join(fixture.mockupsDir, route)), {
      code: "ENOENT",
    });
  });
}

test("build rejects an excluded public resource with its referring route", async (t) => {
  const fixture = await createFixture(
    validEntrySource({
      body: '<iframe src="../README.html" title="Readme" />',
    }),
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.mockupsDir, "README.html"),
    "<p>Private</p>",
  );
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    (error: Error) => {
      assert.match(error.message, /matches public exclusion.*publicExclude/);
      assert.ok(error.message.includes("screens/home"));
      assert.ok(error.message.includes("README.html"));
      return true;
    },
  );
});

test("an excluded imported JSON file remains an authoring input and rebuilds", async (t) => {
  const fixture = await createFixture(
    `${validEntrySource()}\nimport settings from "../mockups/tsconfig.fixture.json"; mockups[1].title = settings.title;`,
  );
  t.after(() => removeFixture(fixture));
  const settings = path.join(fixture.mockupsDir, "tsconfig.fixture.json");
  await fs.writeFile(settings, '{"title":"Before"}');
  const config = await loadConfig(fixture.root);
  const first = await compileCatalogue(config);
  assert.ok(
    first.manifest.sourceFiles.includes("mockups/tsconfig.fixture.json"),
  );
  await writeCompilation(first, config);
  await fs.writeFile(settings, '{"title":"After"}');
  assert.equal(classifyWatchPath(settings, config), "rebuild");
  const second = await compileCatalogue(config);
  assert.equal(
    second.manifest.entries.find((entry) => entry.id === "home")?.title,
    "After",
  );
});

test("canonical builder metadata remains writable when excluded from public reads", async (t) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'publicExclude: ["**/*"],',
  });
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  assert.doesNotThrow(() =>
    validateGeneratedOutputPaths(["mokly-manifest.json"], config),
  );
  assert.equal(
    isOwned(path.join(config.mockupsDir, "mokly-manifest.json"), config),
    true,
  );
  assert.deepEqual(
    isAuthoringSource(
      path.join(config.mockupsDir, "mokly-manifest.json"),
      config,
    ),
    { kind: "exclusion", glob: "**/*" },
  );
});

test("public exclusions preserve explicit watch actions", async (t) => {
  const fixture = await createFixture(undefined, {
    extraConfig:
      'watch: { rules: [{ paths: ["mockups/README.md"], action: "rebuild" }] },',
  });
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  assert.equal(
    classifyWatchPath(path.join(fixture.mockupsDir, "README.md"), config),
    "rebuild",
  );
});
