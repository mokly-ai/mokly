import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../packages/mokly/dist/build/compile.js";
import { validateGeneratedOutputPaths } from "../packages/mokly/dist/build/output_paths.js";
import { writeCompilation } from "../packages/mokly/dist/build/transaction.js";
import { loadConfig } from "../packages/mokly/dist/config/load.js";
import {
  EARLIER_MANIFEST_NAMES,
  MANIFEST_NAME,
  parseManifest,
  readManifest,
} from "../packages/mokly/dist/registry/manifest.js";
import {
  FileSystemReviewAssetReader,
  GitReviewAssetReader,
} from "../packages/mokly/dist/review/assets.js";
import { readBaseManifest } from "../packages/mokly/dist/review/base_manifest.js";
import {
  NodeGitCommandRunner,
  CommittedRepository,
} from "../packages/mokly/dist/review/git.js";
import { startCatalogueServer } from "../packages/mokly/dist/server/http.js";
import { buildPreview } from "../scripts/preview/catalogue.mjs";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

const [FORMER_MANIFEST_NAME, LEGACY_MANIFEST_NAME] = EARLIER_MANIFEST_NAMES;

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
  fixture.beforeRemove(() => server.close());
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
  await fs.promises.mkdir(path.join(fixture.mockupsDir, "page"));
  await fs.promises.symlink(
    `../${MANIFEST_NAME}`,
    path.join(fixture.mockupsDir, "page/index.html"),
  );
  assert.throws(
    () => validateGeneratedOutputPaths(["page/index.html"], config),
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
  fixture.beforeRemove(() => server.close());
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
        /home\/index.*(?:private|protected|missing target)/,
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

test("an earlier manifest name is only an incompatibility sentinel", async (context) => {
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
    /expected Mokly manifest schema version 8/,
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
  await assert.rejects(
    readBaseManifest(git.reader, "HEAD", config),
    (error: unknown) =>
      (error as { code?: string }).code === "baseline-incompatible-earlier",
  );
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
