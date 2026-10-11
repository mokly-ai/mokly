import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { cacheLayout } from "../dist/baseline/cache_layout.js";

import { baselineFixture } from "./helpers/baseline_fixture.js";

for (const format of ["flat-v7", "generated-v6", "generated-v9"] as const) {
  test(`${format} cache rebuilds without reading earlier output`, async () => {
    const { builder, request, fs, calls, layout, manifest } =
      await seed(format);
    const commands = calls.length;
    fs.reads.length = 0;
    const result = await builder.build(request);
    assert.equal(result.cacheHit, false);
    assert.equal(result.marker.manifestVersion, 10);
    assert.equal(result.marker.layout, "generated-v10");
    assert.ok(calls.length > commands);
    assert.equal(fs.reads.includes(manifest), false);
    assert.ok(await fs.stat(layout.marker));
  });

  test(`${format} invalid marker rebuilds before comparing recipe settings`, async () => {
    const { builder, request, calls } = await seed(format);
    const commands = [["other-build"]];
    const count = calls.length;
    const result = await builder.build({ ...request, commands });
    assert.equal(result.cacheHit, false);
    assert.deepEqual(result.marker.commands, commands);
    assert.ok(calls.length > count);
  });
}

async function seed(format: "flat-v7" | "generated-v6" | "generated-v9") {
  const fixture = baselineFixture();
  const completed = await fixture.builder.build(fixture.request);
  const layout = cacheLayout(fixture.request.repoRoot, fixture.request.commit);
  const marker =
    format !== "flat-v7"
      ? {
          ...completed.marker,
          manifestVersion: format === "generated-v9" ? 9 : 6,
          layout: format,
        }
      : {
          schemaVersion: 1,
          commit: fixture.request.commit,
          finishedAt: completed.marker.finishedAt,
          commands: fixture.request.commands,
          manifestVersion: 7,
        };
  const manifest = path.join(
    layout.output,
    format !== "flat-v7"
      ? "mockups/mokly-generated/mokly-manifest.json"
      : "mokly-manifest.json",
  );
  fixture.fs.put(
    manifest,
    "regular",
    Buffer.from(
      JSON.stringify({
        schemaVersion: marker.manifestVersion,
        ignoredOldFields: true,
      }),
    ),
  );
  fixture.fs.put(layout.marker, "regular", Buffer.from(JSON.stringify(marker)));
  return { ...fixture, manifest, layout };
}
