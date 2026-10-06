import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileRuntime } from "../dist/build/compile_runtime.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import {
  componentRuntimeMessage,
  parseRuntimeMessage,
} from "../dist/server/controls/runtime_ipc.js";

import { removeFixture } from "./helpers/fixture.js";
import { entryStyle, styleFixture } from "./helpers/imported_styles_fixture.js";

test("accepted runtime recompilation retains stylesheet routes and binary assets", async (t) => {
  const fixture = await styleFixture('.a{background:url("./image.png")}');
  t.after(() => removeFixture(fixture));
  const image = Buffer.from([0xff, 0, 0x80]);
  await fs.writeFile(path.join(fixture.entriesDir, "image.png"), image);
  const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
  const compiled = await compileRuntime(runtime, async () => {});
  assert.match(compiled.outputs.get(entryStyle) as string, /\.a/);
  assert.deepEqual(
    Buffer.from(
      compiled.outputs.get(
        "mokly-generated/assets/entries/image.png",
      ) as Uint8Array,
    ),
    image,
  );
});

test("watched-runtime IPC transfers binary stylesheet assets and root routes", async (t) => {
  const fixture = await styleFixture('.a{background:url("./image.png")}');
  t.after(() => removeFixture(fixture));
  const image = Buffer.from([0xff, 0, 0x80]);
  await fs.writeFile(path.join(fixture.entriesDir, "image.png"), image);
  const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
  const decoded = parseRuntimeMessage(
    JSON.parse(JSON.stringify(componentRuntimeMessage(runtime))),
  );
  assert.ok(decoded);
  assert.deepEqual(
    new Map(decoded.runtime.stylesheetRoutes).get(fixture.entryPath),
    entryStyle,
  );
  assert.deepEqual(
    new Map(decoded.runtime.styleOutputs).get(
      "mokly-generated/assets/entries/image.png",
    ),
    image,
  );
});
