import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { cacheLayout } from "../dist/baseline/cache_layout.js";
import { cleanupBaselines } from "../dist/baseline/cleanup.js";

import { baselineFixture } from "./helpers/baseline_fixture.js";

test("valid v10 settings mismatch fails intact before output validation", async () => {
  const fixture = baselineFixture();
  const result = await fixture.builder.build(fixture.request);
  const layout = cacheLayout(fixture.request.repoRoot, fixture.request.commit);
  await fixture.fs.remove(layout.output);
  const calls = fixture.calls.length;
  await assert.rejects(
    fixture.builder.build({ ...fixture.request, mockupsPath: "another" }),
    {
      code: "baseline-output-invalid",
      message: `[mokly/baseline-output-invalid] Cached baseline uses different build settings; remove ${layout.entry} before changing catalogues or commands`,
    },
  );
  assert.ok(await fixture.fs.stat(layout.marker));
  assert.equal(fixture.calls.length, calls);
  assert.equal(
    JSON.parse(
      Buffer.from(await fixture.fs.read(layout.marker, 1024 * 1024)).toString(),
    ).manifestVersion,
    result.marker.manifestVersion,
  );
});

test("retention removes invalid metadata under its own lock without reading output", async () => {
  const fixture = baselineFixture();
  await fixture.builder.build(fixture.request);
  const active = cacheLayout(fixture.request.repoRoot, fixture.request.commit);
  const victims = ["b", "c", "d"].map((letter) =>
    cacheLayout("/repo", letter.repeat(40)),
  );
  for (const victim of victims.slice(0, 2)) {
    await fixture.builder.build({
      ...fixture.request,
      commit: path.basename(victim.entry),
    });
  }
  fixture.fs.put(victims[0]!.marker, "regular", Buffer.from(""));
  fixture.fs.put(
    path.join(victims[1]!.entry, "inputs.json"),
    "regular",
    Buffer.from("{"),
  );
  await fixture.fs.mkdir(victims[2]!.entry);
  fixture.fs.put(victims[2]!.marker, "regular", Buffer.from(""));
  fixture.fs.put(victims[2]!.lock, "regular", Buffer.from('{"pid":42}'));
  fixture.fs.reads.length = 0;
  await cleanupBaselines(
    fixture.fs,
    fixture.runner,
    fixture.clock,
    active,
    fixture.request,
    10,
  );
  assert.equal(await fixture.fs.stat(victims[0]!.entry), undefined);
  assert.equal(await fixture.fs.stat(victims[1]!.entry), undefined);
  assert.ok(await fixture.fs.stat(victims[2]!.entry));
  assert.equal(
    fixture.fs.reads.some((file) => file.includes("/output/")),
    false,
  );
});
