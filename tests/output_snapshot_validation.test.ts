import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../packages/mokly/dist/build/compile.js";
import {
  runtimeGraph,
  componentRuntime,
} from "../packages/mokly/dist/build/component_runtime.js";
import { DocumentCompiler } from "../packages/mokly/dist/build/document_compiler.js";
import { prepareLiveRuntime } from "../packages/mokly/dist/build/live_runtime.js";
import { outputLockPath } from "../packages/mokly/dist/build/output_lock.js";
import { loadConfig } from "../packages/mokly/dist/config/load.js";
import {
  componentRuntimeMessage,
  parseRuntimeMessage,
} from "../packages/mokly/dist/server/controls/runtime_ipc.js";

import { createFixture, validEntrySource } from "./helpers/fixture.js";

test("render callbacks run after output snapshot lock release", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.remove());
  const source =
    validEntrySource({ body: "<Probe/>" }) +
    `\nimport fs from 'node:fs';function Probe(){if(fs.existsSync(${JSON.stringify(outputLockPath(fixture.root))}))throw new Error('render holds output lock');return <p>Rendered without the lock</p>;}`;
  await fs.promises.writeFile(fixture.entryPath, source);
  const config = await loadConfig(fixture.root);
  const compiled = await compileCatalogue(config);
  assert.match(
    String(compiled.outputs.get("home/index.mobile.html")),
    /Rendered without the lock/,
  );
  const runtime = await prepareLiveRuntime(config);
  assert.match(
    new DocumentCompiler(runtime, runtimeGraph(runtime)).render(
      "home/index.mobile.html",
    ).html,
    /Rendered without the lock/,
  );
});

test("private runtime transfer retains output proof and refuses a missing or malformed snapshot", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.remove());
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const runtime = componentRuntime(compilation),
    message = componentRuntimeMessage(runtime);
  assert.deepEqual(
    parseRuntimeMessage(JSON.parse(JSON.stringify(message)))?.runtime
      .outputSnapshot,
    runtime.outputSnapshot,
  );
  assert.ok(!JSON.stringify(compilation.manifest).includes("outputSnapshot"));
  for (const outputSnapshot of [
    undefined,
    null,
    { routes: [], orphanRoutes: [], extra: true },
    { routes: [4], orphanRoutes: [] },
  ])
    assert.equal(
      parseRuntimeMessage({
        ...message,
        runtime: { ...message.runtime, outputSnapshot },
      }),
      undefined,
    );
  const unknown = {
    ...runtime,
    outputSnapshot: { ...runtime.outputSnapshot, routes: [] },
  };
  assert.throws(
    () => new DocumentCompiler(unknown, runtimeGraph(runtime)),
    /no accepted output validation/,
  );
});

test("a surviving unowned collision still fails at generation acceptance", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.remove());
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "HOME"),
    "Authored resource",
  );
  const config = await loadConfig(fixture.root);
  await assert.rejects(
    compileCatalogue(config),
    /generated output collision: HOME and home\/index.desktop.html/,
  );
  await assert.rejects(
    prepareLiveRuntime(config),
    /generated output collision: HOME and home\/index.desktop.html/,
  );
});
