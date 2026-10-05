import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { cacheLayout } from "../dist/baseline/cache_layout.js";
import { NodeGitCommandRunner } from "../dist/review/git.js";
import { prepareReviewRepository } from "../dist/review/prepare.js";

import { baselineFixture } from "./helpers/baseline_fixture.js";
import { derivedFixture } from "./helpers/derived_fixture.js";

test("a committed stale root-level v7 manifest selects a generated-subtree rebuild", async (context) => {
  const fixture = await derivedFixture(context);
  await fs.writeFile(
    path.join(fixture.config.mockupsDir, "mokly-manifest.json"),
    JSON.stringify({ schemaVersion: 7 }),
  );
  await fixture.git("add", "mockups/mokly-manifest.json");
  await fixture.git("commit", "-qm", "test: stale root metadata");
  await assert.rejects(fs.stat(fixture.config.generatedDir), {
    code: "ENOENT",
  });
  const git = new NodeGitCommandRunner(fixture.root);
  const trees: (readonly string[])[] = [];
  const result = await prepareReviewRepository(fixture.config, "HEAD", {
    runner: {
      run(args) {
        if (args[0] === "ls-tree") trees.push(args);
        return git.run(args);
      },
    },
  });
  assert.equal(result.selection, "rebuild");
  assert.equal(result.marker?.manifestVersion, 9);
  assert.deepEqual(trees, [
    [
      "ls-tree",
      "-r",
      "-t",
      "-z",
      "--full-tree",
      result.commit,
      "--",
      ":(literal)mockups/mokly-generated",
    ],
  ]);
});

for (const [name, bytes] of [
  ["empty", ""],
  ["truncated", '{"schemaVersion":1,'],
] as const)
  test(name + " cache completion marker leads to a rebuild", async () => {
    const fixture = baselineFixture();
    await fixture.builder.build(fixture.request);
    const before = fixture.calls.length;
    const layout = cacheLayout(
      fixture.request.repoRoot,
      fixture.request.commit,
    );
    fixture.fs.put(layout.marker, "regular", Buffer.from(bytes));
    const rebuilt = await fixture.builder.build(fixture.request);
    assert.equal(rebuilt.cacheHit, false);
    assert.equal(rebuilt.marker.manifestVersion, 9);
    assert.ok(fixture.calls.length > before);
    assert.equal((await fixture.builder.build(fixture.request)).cacheHit, true);
  });

test("cache completion is published by one final atomic rename", async () => {
  const fixture = baselineFixture();
  const layout = cacheLayout(fixture.request.repoRoot, fixture.request.commit);
  const write = fixture.fs.write.bind(fixture.fs);
  const rename = fixture.fs.rename.bind(fixture.fs);
  let published = false;
  fixture.fs.write = async (file, bytes) => {
    assert.notEqual(file, layout.marker, "Never write complete.json in place");
    if (path.basename(file).startsWith("complete-")) {
      assert.equal(await fixture.fs.stat(layout.marker), undefined);
      assert.equal(
        JSON.parse(Buffer.from(bytes).toString()).manifestVersion,
        9,
      );
    }
    await write(file, bytes);
  };
  fixture.fs.rename = async (from, to) => {
    if (to === layout.marker) {
      assert.match(path.basename(from), /^complete-[a-f0-9-]+\.tmp$/);
      assert.equal(await fixture.fs.stat(layout.source), undefined);
      assert.ok(await fixture.fs.stat(path.join(layout.entry, "inputs.json")));
      assert.equal(await fixture.fs.stat(layout.marker), undefined);
      published = true;
    }
    await rename(from, to);
  };
  await fixture.builder.build(fixture.request);
  assert.equal(published, true);
  assert.ok(await fixture.fs.stat(layout.marker));
  assert.equal(
    (await fixture.fs.list(layout.entry)).some((name) => name.endsWith(".tmp")),
    false,
  );
});

for (const failure of ["write", "rename", "cancel"] as const)
  test(`completion ${failure} failure leaves no published marker or temporary`, async () => {
    const fixture = baselineFixture();
    const layout = cacheLayout(
      fixture.request.repoRoot,
      fixture.request.commit,
    );
    const controller = new AbortController();
    const write = fixture.fs.write.bind(fixture.fs);
    const rename = fixture.fs.rename.bind(fixture.fs);
    fixture.fs.write = async (file, bytes) => {
      if (path.basename(file).startsWith("complete-") && failure === "write")
        throw new Error("injected marker write failure");
      await write(file, bytes);
      if (path.basename(file).startsWith("complete-") && failure === "cancel")
        controller.abort();
    };
    fixture.fs.rename = async (from, to) => {
      if (to === layout.marker && failure === "rename")
        throw new Error("injected marker rename failure");
      await rename(from, to);
    };
    await assert.rejects(
      fixture.builder.build({ ...fixture.request, signal: controller.signal }),
      {
        code:
          failure === "cancel"
            ? "baseline-interrupted"
            : "baseline-output-invalid",
      },
    );
    assert.equal(await fixture.fs.stat(layout.marker), undefined);
    assert.equal(await fixture.fs.stat(layout.output), undefined);
    assert.equal(await fixture.fs.stat(layout.lock), undefined);
    assert.equal(
      (await fixture.fs.list(layout.entry)).some((name) =>
        name.endsWith(".tmp"),
      ),
      false,
    );
  });
