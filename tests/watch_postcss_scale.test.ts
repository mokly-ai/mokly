import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import {
  PlainServeReporter,
  type WatchReport,
} from "../dist/server/reporter.js";
import { serve } from "../dist/server/serve.js";
import {
  classifyWatchPath,
  NotificationGate,
  type WatchEvent,
} from "../dist/server/watch_events.js";
import {
  isPackageOwnedIgnoredWatchPath,
  watchTargets,
} from "../dist/server/watch_paths.js";
import {
  ChokidarWatcherFactory,
  createSourceWatcher,
} from "../dist/server/watcher.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { version } from "./helpers/watched_catalogue.js";
import { waitForBrowserReload } from "./helpers/watched_events.js";

test("Tailwind-shaped inventory uses one directory watch target and indexed required paths", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const root = path.join(fixture.root, "sources");
  const sources = Array.from(
    { length: 3_000 },
    (_, index) => `sources/source-${index}.tsx`,
  );
  const config = {
    ...(await loadConfig(fixture.root)),
    sourceFiles: sources,
    postcssWatchDirectories: [{ directory: root, glob: "*.tsx" }],
  };
  const targets = watchTargets(config);
  assert.ok(targets.includes(root));
  assert.ok(targets.length < 20, `unexpected ${targets.length} watch roots`);
  const started = performance.now();
  for (const source of sources)
    assert.equal(
      isPackageOwnedIgnoredWatchPath(path.join(fixture.root, source), config),
      false,
    );
  const elapsed = performance.now() - started;
  assert.ok(
    elapsed < 1_500,
    `3,000 indexed lookups took ${elapsed.toFixed(1)} ms`,
  );
  assert.equal(
    classifyWatchPath(
      { path: path.join(root, "new.tsx"), kind: "add" },
      config,
    ),
    "rebuild",
  );
});

test(
  "a real 3,000-file watched directory becomes ready and sees one new file",
  { timeout: 30_000 },
  async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const root = path.join(fixture.root, "sources");
    await fs.mkdir(root);
    for (let start = 0; start < 3_000; start += 250)
      await Promise.all(
        Array.from({ length: 250 }, (_, offset) =>
          fs.writeFile(
            path.join(root, `source-${start + offset}.tsx`),
            "export default null",
          ),
        ),
      );
    const config = {
      ...(await loadConfig(fixture.root)),
      sourceFiles: Array.from(
        { length: 3_000 },
        (_, index) => `sources/source-${index}.tsx`,
      ),
      postcssWatchDirectories: [{ directory: root, glob: "*.tsx" }],
    };
    let observed = 0;
    const gate = new NotificationGate<WatchEvent>((error) => {
      throw error;
    });
    gate.open((event) => {
      if (
        event.path === path.join(root, "new.tsx") &&
        classifyWatchPath(event, config) === "rebuild"
      )
        observed += 1;
    });
    const watcher = createSourceWatcher(
      new ChokidarWatcherFactory(),
      config,
      gate,
    );
    context.after(() => watcher.close());
    const started = performance.now();
    await watcher.ready();
    const readiness = performance.now() - started;
    assert.ok(
      readiness < 8_000,
      `watcher readiness took ${readiness.toFixed(1)} ms`,
    );
    await fs.writeFile(path.join(root, "new.tsx"), "export default null");
    const deadline = Date.now() + 5_000;
    while (observed === 0 && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(observed, 1);
  },
);

test(
  "watched Serve accepts 3,000 plugin reports and rebuilds once for one added file",
  { timeout: 90_000 },
  async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const directory = path.join(fixture.root, "sources");
    await fs.mkdir(directory);
    for (let start = 0; start < 3_000; start += 250)
      await Promise.all(
        Array.from({ length: 250 }, (_, offset) =>
          fs.writeFile(
            path.join(directory, `source-${start + offset}.tsx`),
            "export default null",
          ),
        ),
      );
    await fs.writeFile(
      path.join(fixture.entriesDir, "fixture.css"),
      ".x{color:red}",
    );
    await fs.appendFile(fixture.entryPath, '\nimport "./fixture.css";');
    await fs.writeFile(
      fixture.configPath,
      (await fs.readFile(fixture.configPath, "utf8")).replace(
        "review: {",
        'postcss: "postcss.config.mjs", watch: { debounceMs: 0 }, review: {',
      ),
    );
    await fs.writeFile(
      path.join(fixture.root, "postcss.config.mjs"),
      `import fs from "node:fs";
import path from "node:path";
const directory = path.join(import.meta.dirname, "sources");
export default { plugins: [{ postcssPlugin: "shape", Once(_root, { result }) {
  for (const name of fs.readdirSync(directory)) result.messages.push({ type: "dependency", plugin: "shape", file: path.join(directory, name) });
  result.messages.push({ type: "dir-dependency", plugin: "shape", dir: directory, glob: "*.tsx" });
} }] };`,
    );
    const config = await loadConfig(fixture.root);
    const actions: string[] = [];
    class CountingReporter extends PlainServeReporter {
      override watchFinished(report: WatchReport): void {
        actions.push(report.action);
      }
    }
    const started = performance.now();
    const running = await serve(
      config,
      { port: 0, watch: true },
      {
        reporter: new CountingReporter(() => {}),
      },
    );
    fixture.beforeRemove(() => running.close());
    const readyMs = performance.now() - started;
    assert.ok(
      readyMs < 12_000,
      `watched Serve readiness took ${readyMs.toFixed(1)} ms`,
    );
    const before = version(
      await fetch(running.url).then((response) => response.text()),
    );
    await waitForBrowserReload(running.url, before, () =>
      fs.writeFile(
        path.join(directory, "source-new.tsx"),
        "export default null",
      ),
    );
    const deadline = Date.now() + 5_000;
    while (
      actions.filter((action) => action === "rebuild").length < 1 &&
      Date.now() < deadline
    )
      await new Promise((resolve) => setTimeout(resolve, 30));
    assert.deepEqual(
      actions.filter((action) => action !== "evidence"),
      ["rebuild"],
    );
  },
);
