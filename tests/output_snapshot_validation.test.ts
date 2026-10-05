import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import {
  runtimeGraph,
  componentRuntime,
} from "../dist/build/component_runtime.js";
import { DocumentCompiler } from "../dist/build/document_compiler.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { outputLockPath } from "../dist/build/output_lock.js";
import { loadConfig } from "../dist/config/load.js";
import {
  componentRuntimeMessage,
  parseRuntimeMessage,
} from "../dist/server/controls/runtime_ipc.js";

import { createFixture, validEntrySource } from "./helpers/fixture.js";

test("render callbacks run without an output snapshot lock", async (t) => {
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
    { schemaVersion: 0, routes: [] },
    { schemaVersion: 2, routes: [] },
    { schemaVersion: 1, routes: [], extra: true },
    { schemaVersion: 1, routes: ["../outside.html"] },
    { schemaVersion: 1, routes: ["z/index.html", "a/index.html"] },
    { schemaVersion: 1, routes: ["a/index.html", "a/index.html"] },
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

test("authored files outside the generated tree do not change accepted routes", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.remove());
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "HOME"),
    "Authored resource",
  );
  const config = await loadConfig(fixture.root);
  const compiled = await compileCatalogue(config);
  const live = await prepareLiveRuntime(config);
  assert.deepEqual(
    live.outputSnapshot.routes,
    [...compiled.outputs.keys()].sort(),
  );
  assert.equal(
    await fs.promises.readFile(path.join(fixture.mockupsDir, "HOME"), "utf8"),
    "Authored resource",
  );
  assert.ok(Object.isFrozen(live.outputSnapshot));
  assert.ok(Object.isFrozen(live.outputSnapshot.routes));
});
