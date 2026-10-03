import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadConsumerGraph } from "../dist/build/load_graph.js";
import { loadConfig } from "../dist/config/load.js";
import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("renderer and all entries use two stylesheet bundles with per-root outputs", async (t) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'renderer: "entries/renderer.ts",',
  });
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "renderer.ts"),
    'import "./shared.css"; export default () => "";',
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "shared.css"),
    ".shared{color:red}",
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "one.css"),
    '.one{color:blue;background:url("./icon.png")}',
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "two.css"),
    '.two{color:green;background:url("./icon.png")}',
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "icon.png"),
    Buffer.from([0, 1, 255]),
  );
  await fs.appendFile(fixture.entryPath, '\nimport "./one.css";');
  await fs.writeFile(
    path.join(fixture.entriesDir, "second.mockup.ts"),
    'import "./shared.css"; import "./two.css"; export const mockups = [];',
  );
  const events: TimingEvent[] = [];
  const config = await loadConfig(fixture.root);
  const graph = await runWithTimings(
    true,
    "test",
    () => loadConsumerGraph(config, false),
    { write: (event) => events.push(event) },
  );
  assert.equal(
    events.filter(
      (event) => event.stage === "styles.bundle" && event.event === "end",
    ).length,
    2,
  );
  const first = graph.styleOutputs.get(
    "mokly-generated/styles/entries/fixture.mockup.tsx.css",
  );
  const second = graph.styleOutputs.get(
    "mokly-generated/styles/entries/second.mockup.ts.css",
  );
  assert.ok(typeof first === "string");
  assert.ok(typeof second === "string");
  assert.match(first, /\.one/);
  assert.doesNotMatch(first, /\.two|\.shared/);
  assert.match(second, /\.two/);
  assert.doesNotMatch(second, /\.one|\.shared/);
  assert.deepEqual(
    graph.styleOutputs.get("mokly-generated/assets/entries/icon.png"),
    new Uint8Array([0, 1, 255]),
  );
  assert.ok(graph.sourceFiles.includes("entries/shared.css"));
  assert.ok(graph.sourceFiles.includes("entries/icon.png"));
});

test("a grouped pass reports the first failing root, not callback order", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "first.css"),
    '@import "./first-missing.css"; .first{color:red}',
  );
  await fs.appendFile(fixture.entryPath, '\nimport "./first.css";');
  await fs.writeFile(
    path.join(fixture.entriesDir, "second.mockup.ts"),
    'import "./second.css"; export const mockups=[];',
  );
  await fs.writeFile(
    path.join(fixture.entriesDir, "second.css"),
    '@import "./second-missing.css"; .second{color:red}',
  );
  await assert.rejects(
    loadConsumerGraph(await loadConfig(fixture.root), false),
    {
      message:
        "[mokly/build-invalid] could not resolve CSS @import in entries/first.css: ./first-missing.css; use an existing stylesheet inside repoRoot",
    },
  );
});
