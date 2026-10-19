import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { benchmark } from "../scripts/large/benchmark.js";

import { generateLargeFixture } from "./fixtures/large/generate.js";
import { repositoryRoot } from "./helpers/fixture.js";

test("build reports preserve default and selected options, CLI flags, and input spans", async (t) => {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/large-build-report-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const fixture = await generateLargeFixture(root, {
    areas: 1,
    screens: 2,
    rows: 1,
  });
  await fs.mkdir(path.join(root, ".context"));
  const cli = path.join(root, "node_modules/@mokly/mokly/bin/mokly.mjs");
  await fs.mkdir(path.dirname(cli), { recursive: true });
  await fs.writeFile(
    cli,
    `import fs from 'node:fs';
fs.writeFileSync('.context/args.json', JSON.stringify(process.argv.slice(2)));
for (const event of ['start', 'end']) {
  process.stderr.write('[mokly:timing] '+JSON.stringify({
    schemaVersion: 1, role: 'core', pid: process.pid, id: 1,
    stage: 'output.fingerprint', event,
    ...(event === 'end' ? {status:'ok',inputPaths:7,retainedBytes:42} : {})
  })+'\\n');
}`,
  );
  for (const options of [
    {},
    { buildChanges: false, buildDeadlineMs: 420_000 },
  ]) {
    const report = await benchmark(
      {
        ...fixture,
        toolchain: { mode: "workspace", installMs: null },
        baseline: "test",
        setupMs: 0,
      },
      ["build"],
      1,
      options,
    );
    const stored = JSON.parse(
      await fs.readFile(path.join(root, ".context/measurements.json"), "utf8"),
    );
    assert.deepEqual(stored, report);
    assert.equal(stored.buildChanges, options.buildChanges ?? true);
    assert.equal(stored.buildDeadlineMs, options.buildDeadlineMs ?? 300_000);
    const args: string[] = JSON.parse(
      await fs.readFile(path.join(root, ".context/args.json"), "utf8"),
    );
    assert.equal(args[0], "build");
    assert.equal(args.includes("--no-changes"), options.buildChanges === false);
    if (options.buildChanges === false) {
      assert.equal(args.includes("--base"), false);
    } else {
      const baseIndex = args.indexOf("--base");
      assert.notEqual(baseIndex, -1);
      assert.equal(args[baseIndex + 1], "test");
    }
    assert.equal(stored.results.length, 1);
    const measured = stored.results[0];
    assert.ok(measured && "status" in measured && "inputProfile" in measured);
    assert.equal(measured.status, "measured");
    const profile = measured.inputProfile;
    assert.ok(
      profile &&
        typeof profile === "object" &&
        "spans" in profile &&
        Array.isArray(profile.spans),
    );
    const spans = profile.spans;
    assert.equal(spans.length, 1);
    assert.equal(spans[0].stage, "output.fingerprint");
    assert.equal(spans[0].status, "ok");
    assert.equal(spans[0].inputPaths, 7);
    assert.equal(spans[0].retainedSourceBytes, 42);
  }
});
