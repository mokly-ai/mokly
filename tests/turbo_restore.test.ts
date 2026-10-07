import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createTurboFixture, runTurbo } from "./helpers/turbo_fixture.js";

test("cache restore repairs owned bytes without cleaning extra files or authored CSS", async (context) => {
  const root = await createTurboFixture(context, true);
  await runTurbo(root, ["run", "example:build", "--force"]);
  const files = [
    "dist/index.js",
    "packages/viewer/dist/index.js",
    "examples/basic/mokly-generated/mokly-manifest.json",
  ];
  const expected = await Promise.all(
    files.map((file) => fs.readFile(path.join(root, file))),
  );
  const css = path.join(root, "examples/basic/styles.css");
  const authored = await fs.readFile(css);
  await fs.rm(path.join(root, files[0]!));
  await fs.writeFile(path.join(root, files[1]!), "corrupted output\n");
  const extra = path.join(root, "dist/extra-output.js");
  await fs.writeFile(extra, "extra output\n");
  const result = await runTurbo(root, ["run", "example:build"]);
  assert.match(result, /3 cached, 3 total/);
  assert.match(result, /FULL TURBO/);
  for (const [index, file] of files.entries())
    assert.deepEqual(await fs.readFile(path.join(root, file)), expected[index]);
  assert.equal(await fs.readFile(extra, "utf8"), "extra output\n");
  assert.deepEqual(await fs.readFile(css), authored);
});

test("forced task execution clears stale package outputs before caching", async (context) => {
  const root = await createTurboFixture(context, true);
  await runTurbo(root, ["run", "build:package", "--force"]);
  const stale = [
    "dist/stale-output.js",
    "packages/viewer/dist/stale-output.js",
  ];
  for (const file of stale)
    await fs.writeFile(path.join(root, file), "stale output\n");
  await runTurbo(root, ["run", "build:package", "--force"]);
  for (const file of stale)
    await assert.rejects(fs.access(path.join(root, file)), { code: "ENOENT" });
});

test("example execution excludes ignored unowned HTML from cache artifacts", async (context) => {
  const root = await createTurboFixture(context, true);
  const generated = path.join(root, "examples/basic/mokly-generated");
  const cssPath = path.join(root, "examples/basic/styles.css");
  const css = await fs.readFile(cssPath);
  await fs.mkdir(generated, { recursive: true });
  const extra = path.join(generated, "unowned-cache-proof.html");
  await fs.writeFile(extra, "<!doctype html><title>unowned</title>\n");
  await runTurbo(root, ["run", "example:build", "--force"]);
  await assert.rejects(fs.access(extra), { code: "ENOENT" });
  assert.deepEqual(await fs.readFile(cssPath), css);
  const restored = await runTurbo(root, ["run", "example:build"]);
  assert.match(restored, /3 cached, 3 total/);
  await assert.rejects(fs.access(extra), { code: "ENOENT" });
});
