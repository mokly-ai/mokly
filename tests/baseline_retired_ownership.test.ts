import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { historicalCatalogueAt } from "../dist/baseline/manifest.js";
import { compileCatalogue } from "../dist/build/compile.js";
import { generatedBytes } from "../dist/build/generated_file.js";
import { loadConfig } from "../dist/config/load.js";
import { parseHistoricalManifest } from "../dist/registry/manifest.js";
import {
  encodeProps,
  reviewMaterialKey,
} from "../packages/viewer/dist/data.js";

import { baselineFixture } from "./helpers/baseline_fixture.js";
import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

test("rebuilt v10 cache validates ownership without changing retained bytes", async (context) => {
  const catalogue = await createFixture(componentEntrySource());
  context.after(() => removeFixture(catalogue));
  const compilation = await compileCatalogue(await loadConfig(catalogue.root));
  const original = compilation.manifest;
  const historical = structuredClone(original);
  const raw = Buffer.from(JSON.stringify(historical));
  const fixture = baselineFixture();
  const run = fixture.runner.run;
  fixture.runner.run = async (command) => {
    const result = await run(command);
    if (command.argv[0] !== "git") {
      const generated = path.join(command.cwd, "mockups/mokly-generated");
      await fixture.fs.remove(generated);
      for (const [route, bytes] of compilation.outputs) {
        let directory = generated;
        await fixture.fs.mkdir(directory);
        for (const part of route.split("/").slice(0, -1)) {
          directory = path.join(directory, part);
          await fixture.fs.mkdir(directory);
        }
        fixture.fs.put(
          path.join(generated, route),
          "regular",
          generatedBytes(bytes),
        );
      }
      fixture.fs.put(
        path.join(generated, "mokly-manifest.json"),
        "regular",
        raw,
      );
    }
    return result;
  };
  const built = await fixture.builder.build(fixture.request);
  assert.equal(built.marker.manifestVersion, 10);
  assert.equal((await fixture.builder.build(fixture.request)).cacheHit, true);
  const manifestPath = path.join(
    built.outputDir,
    "mockups/mokly-generated/mokly-manifest.json",
  );
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
      historicalCatalogueAt(
        fixture.fs,
        built.outputDir,
        path.join(built.outputDir, "mockups"),
        fixture.request.commit,
      ),
      corruption === "props"
        ? /string does not satisfy/
        : corruption === "styles"
          ? /unknown field/
          : /missing resources array/,
    );
    assert.equal(
      (await fixture.builder.build(fixture.request)).cacheHit,
      false,
    );
    assert.equal((await fixture.builder.build(fixture.request)).cacheHit, true);
  }
});
