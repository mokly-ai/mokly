import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { cacheLayout } from "../dist/baseline/cache_layout.js";

import { baselineFixture } from "./helpers/baseline_fixture.js";

for (const format of ["flat-v7", "generated-v6"] as const) {
  test(`${format} cache proves incompatibility without commands or content reads`, async () => {
    const fixture = await seed(format);
    const { builder, request, fs, calls, layout, manifest } = fixture;
    const commands = calls.length;
    fs.reads.length = 0;
    await assert.rejects(builder.build(request), {
      code: "baseline-incompatible-earlier",
    });
    assert.equal(calls.length, commands);
    assert.deepEqual(
      fs.reads.sort(),
      [layout.marker, path.join(layout.entry, "inputs.json"), manifest].sort(),
    );
    assert.ok(await fs.stat(layout.marker));
    assert.ok(await fs.stat(manifest));
  });

  test(`${format} cache retains malformed or mismatched evidence`, async () => {
    for (const contents of [
      "{",
      JSON.stringify({ schemaVersion: 8 }),
      JSON.stringify({ schemaVersion: 9 }),
    ]) {
      const { builder, request, fs, calls, manifest, layout } =
        await seed(format);
      fs.put(manifest, "regular", Buffer.from(contents));
      const count = calls.length;
      await assert.rejects(builder.build(request), {
        code: "baseline-output-invalid",
      });
      assert.equal(calls.length, count);
      assert.ok(await fs.stat(layout.marker));
      assert.equal(
        Buffer.from(await fs.read(manifest, 1024)).toString(),
        contents,
      );
    }
  });

  test(`${format} cache cannot bypass recipe identity`, async () => {
    const { builder, request, fs, layout } = await seed(format);
    await assert.rejects(
      builder.build({ ...request, commands: [["other-build"]] }),
      /different build settings; remove/,
    );
    assert.ok(await fs.stat(layout.marker));
  });
}

async function seed(format: "flat-v7" | "generated-v6") {
  const fixture = baselineFixture();
  const completed = await fixture.builder.build(fixture.request);
  const layout = cacheLayout(fixture.request.repoRoot, fixture.request.commit);
  const marker =
    format === "generated-v6"
      ? { ...completed.marker, manifestVersion: 6, layout: "generated-v6" }
      : {
          schemaVersion: 1,
          commit: fixture.request.commit,
          finishedAt: completed.marker.finishedAt,
          commands: fixture.request.commands,
          manifestVersion: 7,
        };
  const manifest = path.join(
    layout.output,
    format === "generated-v6"
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
