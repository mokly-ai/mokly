import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { baselineManifestVersion } from "../dist/baseline/manifest.js";
import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { parseHistoricalManifest } from "../dist/registry/manifest.js";
import {
  encodeProps,
  reviewMaterialKey,
} from "../packages/viewer/dist/data.js";

import { baselineFixture } from "./helpers/baseline_fixture.js";
import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

test("rebuilt v8 cache accepts retired arrays without changing retained bytes", async (context) => {
  const catalogue = await createFixture(componentEntrySource());
  context.after(() => removeFixture(catalogue));
  const original = (await compileCatalogue(await loadConfig(catalogue.root)))
    .manifest;
  const historical = structuredClone(original);
  for (const entry of historical.entries)
    if ("componentViews" in entry)
      for (const usage of entry.componentViews ?? [])
        Object.assign(usage, {
          styles: [null],
          resources: [{ obsolete: true }],
        });
  const raw = Buffer.from(JSON.stringify(historical));
  const fixture = baselineFixture();
  const run = fixture.runner.run;
  fixture.runner.run = async (command) => {
    const result = await run(command);
    if (command.argv[0] !== "git")
      fixture.fs.put(
        path.join(command.cwd, "mockups/mokly-manifest.json"),
        "regular",
        raw,
      );
    return result;
  };
  const built = await fixture.builder.build(fixture.request);
  assert.equal(built.marker.manifestVersion, 8);
  assert.equal((await fixture.builder.build(fixture.request)).cacheHit, true);
  const manifestPath = path.join(built.outputDir, "mokly-manifest.json");
  const retained = Buffer.from(await fixture.fs.read(manifestPath, raw.length));
  assert.deepEqual(retained, raw);
  assert.deepEqual(
    parseHistoricalManifest(JSON.parse(retained.toString("utf8"))),
    original,
  );

  for (const corruption of ["styles", "resources", "props"] as const) {
    const invalid = structuredClone(historical);
    const screen = invalid.entries.find((entry) => entry.kind === "screen")!;
    assert.ok(screen.kind === "screen" && screen.componentViews);
    const usage = screen.componentViews[0]!;
    if (corruption === "props") {
      const instance = usage.instances.find(
        (item) => item.componentId === "action",
      )!;
      instance.props = encodeProps({ label: 42 });
      instance.propsKey = reviewMaterialKey({ label: 42 });
    } else Object.assign(usage, { [corruption]: {} });
    fixture.fs.put(
      manifestPath,
      "regular",
      Buffer.from(JSON.stringify(invalid)),
    );
    await assert.rejects(
      baselineManifestVersion(
        fixture.fs,
        fixture.request.repoRoot,
        built.outputDir,
      ),
      corruption === "props" ? /string does not satisfy/ : /must be an array/,
    );
    assert.equal(
      (await fixture.builder.build(fixture.request)).cacheHit,
      false,
    );
    assert.equal((await fixture.builder.build(fixture.request)).cacheHit, true);
  }
});
