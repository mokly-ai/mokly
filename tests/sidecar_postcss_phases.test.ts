import assert from "node:assert/strict";
import fs from "node:fs/promises";
import nodeModule from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { observeModuleLoads } from "../packages/mokly/src/sidecar/postcss-evidence.js";
import { phaseLine } from "../packages/mokly/src/sidecar/postcss-phases.js";

test("PostCSS phase records use stable names and explicit durations", () => {
  assert.equal(
    phaseLine({
      phase: "config-load",
      event: "end",
      elapsedMs: 23,
      durationMs: 7,
    }),
    '[mokly:postcss-phase] {"phase":"config-load","event":"end","elapsedMs":23,"durationMs":7}',
  );
});

test("PostCSS module records keep the last module URL", () => {
  assert.equal(
    phaseLine({
      phase: "module",
      event: "module",
      elapsedMs: 4,
      moduleUrl: "file:///C:/fixture/postcss.mjs",
    }),
    '[mokly:postcss-phase] {"phase":"module","event":"module","elapsedMs":4,"moduleUrl":"file:///C:/fixture/postcss.mjs"}',
  );
});

test("module URL observers added after preload hooks still receive loads", async (context) => {
  if (typeof nodeModule.registerHooks !== "function") return;
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-phase-"));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const module = path.join(directory, "module.mjs");
  await fs.writeFile(module, "export default 1;");
  const first: string[] = [];
  const second: string[] = [];
  observeModuleLoads((url) => first.push(url));
  observeModuleLoads((url) => second.push(url));
  await import(`${pathToFileURL(module).href}?phase-observer`);
  assert.ok(first.some((url) => url.startsWith(pathToFileURL(module).href)));
  assert.ok(second.some((url) => url.startsWith(pathToFileURL(module).href)));
});
