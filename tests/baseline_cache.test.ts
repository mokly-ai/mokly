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

test("an earlier manifest sentinel is retained for the compatibility gate", async () => {
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
  assert.equal(result.marker.manifestVersion, 6);
});

test("the oldest manifest sentinel is cached without parsing its contents", async () => {
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
          }),
        ),
      );
    }
    return result;
  };
  const result = await fixture.builder.build(fixture.request);
  assert.equal(result.marker.manifestVersion, 6);
  assert.equal((await fixture.builder.build(fixture.request)).cacheHit, true);
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
