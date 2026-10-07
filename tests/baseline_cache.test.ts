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

test("an unrecognized rebuilt filename cannot identify output", async () => {
  const fixture = baselineFixture();
  const run = fixture.runner.run;
  fixture.runner.run = async (command) => {
    const result = await run(command);
    if (command.argv[0] !== "git") {
      await fixture.fs.remove(
        path.join(command.cwd, "mockups/mokly-generated/mokly-manifest.json"),
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
  await assert.rejects(fixture.builder.build(fixture.request), {
    code: "baseline-output-invalid",
  });
  assert.equal(
    await fixture.fs.stat(
      cacheLayout(fixture.request.repoRoot, fixture.request.commit).marker,
    ),
    undefined,
  );
});

test("an unrecognized malformed rebuilt filename is never parsed", async () => {
  const fixture = baselineFixture();
  const run = fixture.runner.run;
  fixture.runner.run = async (command) => {
    const result = await run(command);
    if (command.argv[0] !== "git") {
      await fixture.fs.remove(
        path.join(command.cwd, "mockups/mokly-generated/mokly-manifest.json"),
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
  await assert.rejects(fixture.builder.build(fixture.request), {
    code: "baseline-output-invalid",
  });
  assert.equal(
    await fixture.fs.stat(
      cacheLayout(fixture.request.repoRoot, fixture.request.commit).marker,
    ),
    undefined,
  );
});

test("corrupt completed cache data rebuilds after marker validation", async () => {
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
  const manifest = path.join(
    result.outputDir,
    "mockups/mokly-generated/mokly-manifest.json",
  );
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
