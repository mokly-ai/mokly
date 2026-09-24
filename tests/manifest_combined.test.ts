import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import {
  parseHistoricalManifest,
  parseManifest,
} from "../dist/registry/manifest.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

const pageSource = `import { definePage } from "@mokly/mokly";
export const mockups = [definePage({ id: "handbook", title: "Handbook", description: "Document", dependencies: [], relatedDocs: [], route: "handbook.html", render: () => "<html><body>Handbook</body></html>" })];`;

test("the current manifest combines pages and complete component usage without legacy roots", async (context) => {
  const fixture = await createFixture(componentEntrySource());
  context.after(() => removeFixture(fixture));
  await fs.writeFile(`${fixture.entriesDir}/handbook.mockup.ts`, pageSource);
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const current = parseManifest(compilation.manifest);
  assert.equal(current.schemaVersion, 6);
  assert.equal("legacyPages" in current, false);
  assert.ok(current.sourceFiles.includes("entries/handbook.mockup.ts"));
  assert.ok(current.entries.some((entry) => entry.kind === "page"));
  assert.ok(current.entries.some((entry) => entry.kind === "component"));
  const screen = current.entries.find((entry) => entry.kind === "screen");
  assert.ok(screen?.componentViews?.every((view) => view.instances.length > 0));
  assert.match(compilation.outputs.get("handbook.html") ?? "", /Handbook/);
});

test("both disjoint historical v4 formats remain readable only at the Git boundary", async (context) => {
  const componentFixture = await createFixture(componentEntrySource());
  const pageFixture = await createFixture(pageSource);
  context.after(() => removeFixture(componentFixture));
  context.after(() => removeFixture(pageFixture));
  const components = (
    await compileCatalogue(await loadConfig(componentFixture.root))
  ).manifest;
  const pages = (await compileCatalogue(await loadConfig(pageFixture.root)))
    .manifest;
  const {
    assetClosure: _assetClosure,
    blobHashAlgorithm: _blobHashAlgorithm,
    generatedFiles: _generatedFiles,
    ...legacyPages
  } = pages;
  const componentV4 = {
    schemaVersion: 4,
    generatedBy: "mokly",
    legacyPages: [],
    entries: components.entries,
  };
  const pageV4 = {
    ...legacyPages,
    schemaVersion: 4,
    entries: pages.entries.map(
      ({ declaredDependencies: _declared, ...entry }) => entry,
    ),
  };
  for (const historical of [componentV4, pageV4]) {
    assert.equal(parseHistoricalManifest(historical).schemaVersion, 4);
    assert.throws(() => parseManifest(historical), /schema version 6/);
  }
  assert.throws(() =>
    parseHistoricalManifest({ ...componentV4, sourceFiles: [] }),
  );
  assert.throws(() => parseHistoricalManifest({ ...pageV4, legacyPages: [] }));
  const invalidUsage = structuredClone(componentV4);
  const screen = invalidUsage.entries.find((entry) => entry.kind === "screen");
  assert.ok(screen);
  Reflect.deleteProperty(screen, "componentViews");
  assert.throws(() => parseHistoricalManifest(invalidUsage));
});
