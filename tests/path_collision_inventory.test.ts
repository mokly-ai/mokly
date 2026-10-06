import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { runtimeGraph } from "../packages/mokly/dist/build/component_runtime.js";
import { DocumentCompiler } from "../packages/mokly/dist/build/document_compiler.js";
import { prepareLiveRuntime } from "../packages/mokly/dist/build/live_runtime.js";
import { generatedHeader } from "../packages/mokly/dist/build/ownership.js";

import { pageSource, pathFixture } from "./helpers/path_fixture.js";

test("demand output collision inventory is scanned once and renewed for each generation", async (t) => {
  const fixture = await pathFixture({
    "specs/one.mockup.ts": pageSource(),
    "specs/two.mockup.ts": pageSource(),
  });
  t.after(fixture.remove);
  await fixture.write(
    "generated/old/index.html",
    generatedHeader("specs/one.mockup.ts") + "<html><body>Old</body></html>",
  );
  const config = await fixture.config();
  const readdir = fs.readdirSync;
  let scans = 0;
  t.mock.method(fs, "readdirSync", (...args: unknown[]) => {
    if (args[0] === config.mockupsDir) scans++;
    return Reflect.apply(readdir, fs, args);
  });
  const runtime = await prepareLiveRuntime(config);
  const captured = scans;
  const compiler = new DocumentCompiler(runtime, runtimeGraph(runtime));
  compiler.render("one/index.html");
  const initial = scans;
  assert.ok(initial > 0);
  assert.equal(
    initial,
    captured,
    "demand rendering cannot scan a half-written tree",
  );
  compiler.render("two/index.html");
  assert.equal(
    scans,
    initial,
    "uncached documents must reuse the collision inventory",
  );
  await fixture.write("generated/ONE", "Conflicting resource");
  await assert.rejects(prepareLiveRuntime(config), /collision/);
  assert.ok(scans > initial);
  assert.ok(fs.existsSync(path.join(config.mockupsDir, "ONE")));
});
