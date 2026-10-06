import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { compileRuntime } from "../dist/build/compile_runtime.js";
import { runtimeGraph } from "../dist/build/component_runtime.js";
import { DocumentCompiler } from "../dist/build/document_compiler.js";
import { GENERATED_MARKER } from "../dist/build/generated_marker.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
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
    assert.equal(runtime.manifest.schemaVersion, "live-index-2");
    assert.deepEqual(runtime.outputs, []);
    assert.throws(() => parseManifest(runtime.manifest), {
      code: "manifest-invalid",
    });
    const compiler = new DocumentCompiler(runtime, runtimeGraph(runtime));
    const complete = await compileCatalogue(config);
    for (const [route, expected] of complete.outputs) {
      if (route === MANIFEST_NAME) continue;
      const rendered = compiler.render(route);
      assert.equal(rendered.html, expected, route);
      assert.deepEqual(rendered.diagnostics, [], route);
      const cached = compiler.render(route);
      assert.equal(cached.html, expected, `cached ${route}`);
      assert.deepEqual(cached.diagnostics, [], `cached ${route}`);
    }
  });
}

test("demand links reject an unknown generated route even when a local file exists", async (t) => {
  const fixture = await createFixture(
    validEntrySource({ body: '<a href="../old.html">Old</a>' }),
  );
  t.after(() => removeFixture(fixture));
  await fs.mkdir(path.join(fixture.mockupsDir, "mokly-generated"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(fixture.mockupsDir, "mokly-generated/old.html"),
    GENERATED_MARKER + "<html><body>Old</body></html>\n",
  );
  const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
  const compiler = new DocumentCompiler(runtime, runtimeGraph(runtime));
  assert.throws(
    () => compiler.render("home/index.desktop.html"),
    /missing target/,
  );
});

test("live index checks dependency declarations before accepting unrendered entries", async (t) => {
  const fixture = await createFixture(componentEntrySource());
  t.after(() => removeFixture(fixture));
  const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
  const corrupt = structuredClone(runtime.manifest);
  const entry = corrupt.entries.find(
    (value) => value.kind === "component" && !("variantOf" in value),
  )!;
  Object.assign(entry, {
    declaredDependencies: [],
    ownedDependencies: ["notes.md"],
  });
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
