import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compactRuntime } from "../dist/build/compact_runtime.js";
import { compileCatalogue } from "../dist/build/compile.js";
import { compileRuntime } from "../dist/build/compile_runtime.js";
import { componentRuntime } from "../dist/build/component_runtime.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import { parseManifest, serializeManifest } from "../dist/registry/manifest.js";
import { receiveComponentRuntimeStartup } from "../dist/server/controls/runtime_ipc.js";
import { LivePublicCatalogue } from "../dist/server/public_catalogue.js";
import { readCatalogue } from "../packages/viewer/dist/catalogue/reader.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { viewerCatalogue } from "../packages/viewer/dist/viewer/projection.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import {
  createFixture,
  registerFixturePage,
  removeFixture,
} from "./helpers/fixture.js";

test("canonical and display catalogue producers retain their current dependency fields", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "component.mockup.tsx"),
    componentEntrySource().replace('id: "home"', 'id: "component-host"'),
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "page.ts"),
    'export const source = () => "<html><body>Page</body></html>";',
  );
  await registerFixturePage(
    fixture,
    "document",
    "pages/document.html",
    "entries/page.ts",
  );
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const live = await prepareLiveRuntime(config);
  const compacted = compactRuntime(componentRuntime(compilation));
  const startup = receiveComponentRuntimeStartup();
  process.emit(
    "message",
    structuredClone({
      type: "component-runtime-startup",
      config: live.config,
      manifest: live.manifest,
    }),
  );
  const transferred = (await startup).manifest;
  const background = await compileRuntime(
    structuredClone(compacted),
    async () => {},
  );
  for (const [label, manifest] of [
    ["v8 build", compilation.manifest],
    [
      "v8 JSON",
      parseManifest(JSON.parse(serializeManifest(compilation.manifest))),
    ],
    ["live index", live.manifest],
    ["Serve compact runtime", compacted.manifest],
    ["startup IPC", transferred],
    ["background worker compilation", background.manifest],
  ] as const) {
    assert.deepEqual(
      [...new Set(manifest.entries.map((entry) => entry.kind))].sort(),
      ["component", "page", "screen", "use-case"],
    );
    const source = new LivePublicCatalogue(
      config,
      {
        catalogue: createCatalogue(manifest),
        changesStatus: "pending",
        comparisonUrl: null,
      },
      1,
    );
    const model = readCatalogue(JSON.parse(source.read()));
    const published = [
      ...model.screens,
      ...model.pages,
      ...model.useCases,
      ...model.components,
    ];
    const display = viewerCatalogue(model);
    assert.equal(display.manifest.schemaVersion, "live-index-1");
    for (const entry of display.manifest.entries) {
      assert.equal(
        Object.hasOwn(entry, "dependencies"),
        true,
        label + ": display " + entry.id,
      );
      assert.deepEqual(
        (entry as { dependencies?: unknown }).dependencies,
        published.find((record) => record.id === entry.id)?.details
          .dependencies,
      );
    }
    const displayed = readCatalogue(
      JSON.parse(
        new LivePublicCatalogue(
          config,
          {
            catalogue: display,
            changesStatus: "pending",
            comparisonUrl: null,
          },
          1,
        ).read(),
      ),
    );
    assert.deepEqual(
      [
        ...displayed.screens,
        ...displayed.pages,
        ...displayed.useCases,
        ...displayed.components,
      ].map((entry) => [entry.id, entry.details.dependencies]),
      published.map((entry) => [entry.id, entry.details.dependencies]),
    );
    for (const entry of manifest.entries) {
      assert.equal(
        Object.hasOwn(entry, "dependencies"),
        false,
        label + ": " + entry.id,
      );
      assert.ok(
        Array.isArray(entry.declaredDependencies),
        label + ": " + entry.id,
      );
      assert.deepEqual(
        published.find((record) => record.id === entry.id)?.details
          .dependencies,
        [...new Set([entry.sourcePath, ...entry.declaredDependencies])].sort(),
        label + ": " + entry.id,
      );
    }
    t.diagnostic(
      label +
        ": " +
        manifest.entries.length +
        " canonical entries omit dependencies; current display entries include it",
    );
  }
});
