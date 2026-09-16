import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { validateGeneratedOutputPaths } from "../dist/build/output_paths.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import {
  FORMER_MANIFEST_NAME,
  LEGACY_MANIFEST_NAME,
  MANIFEST_NAME,
  parseManifest,
  readManifest,
} from "../dist/registry/manifest.js";
import {
  FileSystemReviewAssetReader,
  GitReviewAssetReader,
} from "../dist/review/assets.js";
import { readBaseManifest } from "../dist/review/base_manifest.js";
import {
  NodeGitCommandRunner,
  CommittedRepository,
} from "../dist/review/git.js";
import { startCatalogueServer } from "../dist/server/http.js";
import { buildPreview } from "../scripts/preview/catalogue.mjs";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

const metadataRoutes = [
  MANIFEST_NAME,
  FORMER_MANIFEST_NAME,
  LEGACY_MANIFEST_NAME,
  "metadata.json",
];
const publicJson = '{"theme":"light"}';

test("a stale historical-manifest alias does not prevent ordinary public resources", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  await fs.promises.symlink(
    "missing.json",
    path.join(fixture.mockupsDir, LEGACY_MANIFEST_NAME),
  );
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "public.json"),
    publicJson,
  );
  const server = await startCatalogueServer(config, { base: "HEAD", port: 0 });
  context.after(() => server.close());
  assert.equal(
    await (await fetch(`${server.url}/static/public.json`)).text(),
    publicJson,
  );
  assert.equal(
    (await fetch(`${server.url}/static/${LEGACY_MANIFEST_NAME}`)).status,
    404,
  );
});

test("a pending manifest is not a public resource on the first build", async (context) => {
  const fixture = await createFixture(
    validEntrySource({
      body: '<a href="../mokly-manifest.json">Metadata</a>',
    }),
  );
  context.after(() => removeFixture(fixture));
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    /target .*mokly-manifest.json.*internal catalogue metadata/,
  );
  assert.equal(
    fs.existsSync(path.join(fixture.mockupsDir, MANIFEST_NAME)),
    false,
  );
});

test("generated page routes cannot overwrite a manifest through an alias", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await writeCompilation(await compileCatalogue(config), config);
  await fs.promises.symlink(
    MANIFEST_NAME,
    path.join(fixture.mockupsDir, "page.html"),
  );
  assert.throws(
    () => validateGeneratedOutputPaths(["page.html"], config),
    /targets internal catalogue metadata/,
  );
  validateGeneratedOutputPaths([MANIFEST_NAME], config);
});

test("HTTP and current Review deny internal manifests and aliases but allow public JSON", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  await writeCompilation(compilation, config);
  await fs.promises.copyFile(
    path.join(fixture.mockupsDir, MANIFEST_NAME),
    path.join(fixture.mockupsDir, LEGACY_MANIFEST_NAME),
  );
  await fs.promises.copyFile(
    path.join(fixture.mockupsDir, MANIFEST_NAME),
    path.join(fixture.mockupsDir, FORMER_MANIFEST_NAME),
  );
  await fs.promises.symlink(
    MANIFEST_NAME,
    path.join(fixture.mockupsDir, "metadata.json"),
  );
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "public.json"),
    publicJson,
  );
  const server = await startCatalogueServer(config, { base: "HEAD", port: 0 });
  context.after(() => server.close());
  const reader = new FileSystemReviewAssetReader(config);
  for (const route of metadataRoutes) {
    for (const method of ["GET", "HEAD"])
      assert.equal(
        (await fetch(`${server.url}/static/${route}`, { method })).status,
        404,
        `${method} ${route}`,
      );
    await assert.rejects(reader.read(route), /not a public static file/, route);
  }
  assert.equal(
    await (await fetch(`${server.url}/static/public.json`)).text(),
    publicJson,
  );
  assert.equal(
    Buffer.from(await reader.read("public.json")).toString(),
    publicJson,
  );
  assert.deepEqual(readManifest(config), compilation.manifest);
});

for (const route of metadataRoutes) {
  test(`build rejects a resource or link to internal metadata: ${route}`, async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    await writeCompilation(await compileCatalogue(config), config);
    await fs.promises.copyFile(
      path.join(fixture.mockupsDir, MANIFEST_NAME),
      path.join(fixture.mockupsDir, LEGACY_MANIFEST_NAME),
    );
    await fs.promises.copyFile(
      path.join(fixture.mockupsDir, MANIFEST_NAME),
      path.join(fixture.mockupsDir, FORMER_MANIFEST_NAME),
    );
    await fs.promises.symlink(
      MANIFEST_NAME,
      path.join(fixture.mockupsDir, "metadata.json"),
    );
    for (const body of [
      `<a href="../${route}">Metadata</a>`,
      `<img alt="Metadata" src="../${route}" />`,
    ]) {
      await fs.promises.writeFile(
        fixture.entryPath,
        validEntrySource({ body }),
      );
      await assert.rejects(
        compileCatalogue(config),
        /screens\/home.*(?:private|protected|missing target)/,
        body,
      );
    }
  });
}

for (const includeChanges of [false, true]) {
  test(`publication omits internal metadata and preserves public JSON (changes: ${includeChanges})`, async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    await writeCompilation(await compileCatalogue(config), config);
    await fs.promises.copyFile(
      path.join(fixture.mockupsDir, MANIFEST_NAME),
      path.join(fixture.mockupsDir, LEGACY_MANIFEST_NAME),
    );
    await fs.promises.copyFile(
      path.join(fixture.mockupsDir, MANIFEST_NAME),
      path.join(fixture.mockupsDir, FORMER_MANIFEST_NAME),
    );
    await fs.promises.symlink(
      MANIFEST_NAME,
      path.join(fixture.mockupsDir, "metadata.json"),
    );
    await fs.promises.writeFile(
      path.join(fixture.mockupsDir, "public.json"),
      publicJson,
    );
    if (includeChanges) {
      const runner = new NodeGitCommandRunner(fixture.root);
      await runner.run(["init", "-q"]);
      await runner.run(["add", "."]);
      await runner.run([
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.invalid",
        "commit",
        "-qm",
        "test: metadata baseline",
      ]);
    }
    const output = path.join(fixture.root, ".context/published");
    await buildPreview(
      config,
      output,
      includeChanges ? { includeChanges, base: "HEAD" } : {},
    );
    for (const route of metadataRoutes)
      assert.equal(
        fs.existsSync(path.join(output, "static", route)),
        false,
        route,
      );
    assert.equal(
      await fs.promises.readFile(
        path.join(output, "static/public.json"),
        "utf8",
      ),
      publicJson,
    );
    assert.ok(
      readManifest(config).sourceFiles.includes("entries/fixture.mockup.tsx"),
    );
  });
}

test("the former Mokabook manifest is accepted only from Git history", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const formerManifest = {
    ...compilation.manifest,
    generatedBy: "mokabook",
  };
  assert.throws(
    () => parseManifest(formerManifest),
    /expected Mokly manifest schema version 5/,
  );
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, FORMER_MANIFEST_NAME),
    JSON.stringify(formerManifest),
  );
  const runner = new NodeGitCommandRunner(fixture.root);
  await runner.run(["init", "-q"]);
  await runner.run(["add", "."]);
  await runner.run([
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "-qm",
    "test: former Mokabook metadata",
  ]);
  const git = new CommittedRepository(runner);
  const baseline = await readBaseManifest(git.reader, "HEAD", config);
  assert.deepEqual(baseline, compilation.manifest);
  const reader = new GitReviewAssetReader(
    config,
    git.reader,
    "HEAD",
    "mockups",
  );
  await assert.rejects(
    reader.read(FORMER_MANIFEST_NAME),
    /not a public static file/,
  );
});

for (const schemaVersion of [2, 3, 4, 5]) {
  test(`historical v${schemaVersion} manifests remain readable internally but cannot become Review assets`, async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    const compilation = await compileCatalogue(config);
    await writeCompilation(compilation, config);
    const { sourceFiles: _sources, ...historical } = compilation.manifest;
    const manifest =
      schemaVersion === 5
        ? compilation.manifest
        : schemaVersion === 4
          ? {
              ...compilation.manifest,
              schemaVersion: 4,
              entries: compilation.manifest.entries.map(
                ({ declaredDependencies: _declared, ...entry }) => entry,
              ),
            }
          : {
              ...historical,
              schemaVersion,
              generatedBy: schemaVersion === 2 ? "mockbook" : "mokly",
              legacyPages: [],
            };
    const filename = schemaVersion === 2 ? LEGACY_MANIFEST_NAME : MANIFEST_NAME;
    if (schemaVersion === 2)
      await fs.promises.rm(path.join(fixture.mockupsDir, MANIFEST_NAME));
    await fs.promises.writeFile(
      path.join(fixture.mockupsDir, filename),
      JSON.stringify(manifest),
    );
    await fs.promises.symlink(
      filename,
      path.join(fixture.mockupsDir, "metadata.json"),
    );
    await fs.promises.writeFile(
      path.join(fixture.mockupsDir, "public.json"),
      publicJson,
    );
    const runner = new NodeGitCommandRunner(fixture.root);
    await runner.run(["init", "-q"]);
    await runner.run(["add", "."]);
    await runner.run([
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-qm",
      "test: historical metadata",
    ]);
    const git = new CommittedRepository(runner);
    config.compatibility.readManifestV2 = schemaVersion === 2;
    const baseline = await readBaseManifest(git.reader, "HEAD", config);
    assert.equal(
      baseline.schemaVersion,
      schemaVersion === 2 ? 3 : schemaVersion,
    );
    const reader = new GitReviewAssetReader(
      config,
      git.reader,
      "HEAD",
      "mockups",
    );
    for (const route of [filename, "metadata.json"])
      await assert.rejects(
        reader.read(route),
        /not a public static file|not a regular Git file/,
        route,
      );
    assert.equal(
      Buffer.from(await reader.read("public.json")).toString(),
      publicJson,
    );
  });
}
