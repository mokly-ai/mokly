import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  cacheLayout,
  parseCompletionMarker,
} from "../dist/baseline/cache_layout.js";

import {
  baselineFixture,
  baselineManifest,
} from "./helpers/baseline_fixture.js";

test("a former Mokabook manifest remains valid rebuilt history", async () => {
  const fixture = baselineFixture();
  const run = fixture.runner.run;
  fixture.runner.run = async (command) => {
    const result = await run(command);
    if (command.argv[0] !== "git") {
      await fixture.fs.remove(
        path.join(command.cwd, "mockups/mokly-manifest.json"),
      );
      await fixture.fs.write(
        path.join(command.cwd, "mockups/mokabook-manifest.json"),
        Buffer.from(
          JSON.stringify({ ...baselineManifest, generatedBy: "mokabook" }),
        ),
      );
    }
    return result;
  };
  const result = await fixture.builder.build(fixture.request);
  assert.equal(result.marker.manifestVersion, 5);
});

test("current v6 baselines remain reusable after marker validation", async () => {
  const fixture = baselineFixture();
  const run = fixture.runner.run;
  fixture.runner.run = async (command) => {
    const result = await run(command);
    if (command.argv[0] !== "git") {
      await fixture.fs.remove(
        path.join(command.cwd, "mockups/mokly-manifest.json"),
      );
      await fixture.fs.write(
        path.join(command.cwd, "mockups/mokly-manifest.json"),
        Buffer.from(JSON.stringify({ ...baselineManifest, schemaVersion: 6 })),
      );
    }
    return result;
  };
  const first = await fixture.builder.build(fixture.request);
  assert.equal(first.marker.manifestVersion, 6);
  const second = await fixture.builder.build(fixture.request);
  assert.equal(second.cacheHit, true);
  assert.deepEqual(second.marker, first.marker);
});

test("legacy rebuilt manifests retain version 2 and require explicit compatibility", async () => {
  const fixture = baselineFixture();
  const run = fixture.runner.run;
  fixture.runner.run = async (command) => {
    const result = await run(command);
    if (command.argv[0] !== "git") {
      await fixture.fs.remove(
        path.join(command.cwd, "mockups/mokly-manifest.json"),
      );
      await fixture.fs.write(
        path.join(command.cwd, "mockups/mockbook-manifest.json"),
        Buffer.from(
          JSON.stringify({
            schemaVersion: 2,
            generatedBy: "mockbook",
            entries: [],
            legacyPages: [],
          }),
        ),
      );
    }
    return result;
  };
  const request = { ...fixture.request, allowManifestV2: true };
  const result = await fixture.builder.build(request);
  assert.equal(result.marker.manifestVersion, 2);
  assert.equal((await fixture.builder.build(request)).cacheHit, true);
  await assert.rejects(
    fixture.builder.build({ ...fixture.request, commit: "b".repeat(40) }),
    { code: "baseline-output-invalid" },
  );
});

test("invalid cache markers are partial entries and cannot hide corrupt manifests", async () => {
  const { builder, request, fs } = baselineFixture();
  const result = await builder.build(request);
  assert.equal(
    parseCompletionMarker(
      { ...result.marker, commit: "b".repeat(40) },
      request.commit,
    ),
    undefined,
  );
  assert.equal(
    parseCompletionMarker({ ...result.marker, commands: [[]] }, request.commit),
    undefined,
  );
  assert.equal(
    parseCompletionMarker(
      { ...result.marker, finishedAt: "invalid" },
      request.commit,
    ),
    undefined,
  );
  const manifest = path.join(result.outputDir, "mokly-manifest.json");
  fs.put(manifest, "regular", Buffer.from("{}"));
  assert.equal((await builder.build(request)).cacheHit, false);
  const layout = cacheLayout(request.repoRoot, request.commit);
  fs.put(
    layout.marker,
    "regular",
    Buffer.from(JSON.stringify({ ...result.marker, commit: "b".repeat(40) })),
  );
  assert.equal((await builder.build(request)).cacheHit, false);
});
