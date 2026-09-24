import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { compileRuntime } from "../dist/build/compile_runtime.js";
import { runtimeGraph } from "../dist/build/component_runtime.js";
import { DocumentCompiler } from "../dist/build/document_compiler.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { generatedHeader } from "../dist/build/ownership.js";
import { loadConfig } from "../dist/config/load.js";
import { parseCatalogueIndex } from "../dist/registry/catalogue_index.js";
import { parseManifest, MANIFEST_NAME } from "../dist/registry/manifest.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

for (const source of [validEntrySource(), componentEntrySource()]) {
  test("demand documents match exhaustive bytes and retain explicit incomplete usage", async (t) => {
    const fixture = await createFixture(source);
    t.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    const runtime = await prepareLiveRuntime(config);
    assert.equal(runtime.manifest.schemaVersion, "live-index-1");
    assert.deepEqual(runtime.outputs, []);
    assert.throws(() => parseManifest(runtime.manifest), {
      code: "manifest-invalid",
    });
    const compiler = new DocumentCompiler(runtime, runtimeGraph(runtime));
    const complete = await compileCatalogue(config);
    for (const [route, expected] of complete.outputs) {
      if (route === MANIFEST_NAME) continue;
      assert.equal(compiler.render(route).html, expected, route);
      assert.equal(compiler.render(route).html, expected, `cached ${route}`);
    }
  });
}

test("demand links reject a generated orphan even while its old file exists", async (t) => {
  const fixture = await createFixture(
    validEntrySource({ body: '<a href="../old.html">Old</a>' }),
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.mockupsDir, "old.html"),
    generatedHeader("entries/fixture.mockup.tsx") +
      "<html><body>Old</body></html>\n",
  );
  const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
  const compiler = new DocumentCompiler(runtime, runtimeGraph(runtime));
  assert.throws(
    () => compiler.render("screens/home.desktop.html"),
    /missing target/,
  );
});

test("live index checks dependency declarations before accepting unrendered entries", async (t) => {
  const fixture = await createFixture(componentEntrySource());
  t.after(() => removeFixture(fixture));
  const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
  const corrupt = structuredClone(runtime.manifest);
  const entry = corrupt.entries.find((value) => value.kind === "component")!;
  Object.assign(entry, { declaredDependencies: [] });
  assert.throws(() => parseCatalogueIndex(corrupt), /dependencies/);
});

test("background validation preserves exhaustive render order across forward anchor links", async (t) => {
  const source =
    validEntrySource({
      body: '<a href="mock:details#details">Details</a><Stamp />',
    })
      .replace('id="details-mobile"', 'id="details"')
      .replace(">Detail</main>", ">Detail<Stamp /></main>") +
    "\nlet count = 0; function Stamp() { return <span>{++count}</span>; }";
  const fixture = await createFixture(source.replaceAll("details", "zdetails"));
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const expected = await compileCatalogue(config);
  const actual = await compileRuntime(
    await prepareLiveRuntime(config),
    async () => {},
  );
  assert.deepEqual(actual.outputs, expected.outputs);
});
