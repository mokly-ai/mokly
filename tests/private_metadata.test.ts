import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { validateGeneratedOutputPaths } from "../dist/build/output_paths.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { MANIFEST_NAME, readManifest } from "../dist/registry/manifest.js";
import { FileSystemReviewAssetReader } from "../dist/review/assets.js";
import { NodeGitCommandRunner } from "../dist/review/git.js";
import { startCatalogueServer } from "../dist/server/http.js";
import { buildPreview } from "../scripts/preview/catalogue.mjs";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";
import { metadataRoutes, publicJson } from "./private_metadata_fixture.js";

test("a dangling canonical-manifest alias does not prevent ordinary public resources", async (context) => {
  const fixture = await createFixture(
    validEntrySource({ body: '<a href="../../public.json">Public</a>' }),
  );
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "public.json"),
    publicJson,
  );
  await writeCompilation(await compileCatalogue(config), config);
  await fs.promises.symlink(
    "missing.json",
    path.join(fixture.mockupsDir, MANIFEST_NAME),
  );
  const server = await startCatalogueServer(config, { base: "HEAD", port: 0 });
  fixture.beforeRemove(() => server.close());
  assert.equal(
    await (await fetch(`${server.url}/static/public.json`)).text(),
    publicJson,
  );
  assert.equal(
    (await fetch(`${server.url}/static/${MANIFEST_NAME}`)).status,
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
  await assert.rejects(compileCatalogue(await loadConfig(fixture.root)), {
    code: "build-invalid",
    message:
      "[mokly/build-invalid] document links and resources are invalid:\n- mokly-generated/home/index.desktop.html: protected target ../mokly-manifest.json: targets internal catalogue metadata\n- mokly-generated/home/index.mobile.html: protected target ../mokly-manifest.json: targets internal catalogue metadata",
  });
  assert.equal(
    fs.existsSync(
      path.join(fixture.mockupsDir, "mokly-generated", MANIFEST_NAME),
    ),
    false,
  );
});

test("generated page routes cannot overwrite a manifest through an alias", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  await writeCompilation(compilation, config);
  const fragment = path.join(config.generatedDir, "home/index.mobile.html");
  await fs.promises.rm(fragment);
  await fs.promises.symlink("../mokly-manifest.json", fragment);
  await assert.rejects(
    writeCompilation(compilation, config),
    /contains a symlink or non-regular entry/,
  );
  validateGeneratedOutputPaths([MANIFEST_NAME], config);
});

test("HTTP and current Review deny internal manifests and aliases but allow public JSON", async (context) => {
  const fixture = await createFixture(
    validEntrySource({ body: '<a href="../../public.json">Public</a>' }),
  );
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "public.json"),
    publicJson,
  );
  const compilation = await compileCatalogue(config);
  await writeCompilation(compilation, config);
  await fs.promises.copyFile(
    path.join(config.generatedDir, MANIFEST_NAME),
    path.join(fixture.mockupsDir, MANIFEST_NAME),
  );
  await fs.promises.symlink(
    `mokly-generated/${MANIFEST_NAME}`,
    path.join(fixture.mockupsDir, "metadata.json"),
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
      path.join(config.generatedDir, MANIFEST_NAME),
      path.join(fixture.mockupsDir, MANIFEST_NAME),
    );
    await fs.promises.symlink(
      `mokly-generated/${MANIFEST_NAME}`,
      path.join(fixture.mockupsDir, "metadata.json"),
    );
    for (const body of [
      `<a href="../../${route}">Metadata</a>`,
      `<img alt="Metadata" src="../../${route}" />`,
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
    const fixture = await createFixture(
      validEntrySource({ body: '<a href="../../public.json">Public</a>' }),
    );
    context.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    await fs.promises.writeFile(
      path.join(fixture.mockupsDir, "public.json"),
      publicJson,
    );
    await writeCompilation(await compileCatalogue(config), config);
    await fs.promises.copyFile(
      path.join(config.generatedDir, MANIFEST_NAME),
      path.join(fixture.mockupsDir, MANIFEST_NAME),
    );
    await fs.promises.symlink(
      `mokly-generated/${MANIFEST_NAME}`,
      path.join(fixture.mockupsDir, "metadata.json"),
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
