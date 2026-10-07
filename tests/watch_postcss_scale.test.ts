import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
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

import { reportDuration } from "./helpers/durations.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import { version } from "./helpers/watched_catalogue.js";
import { waitForBrowserReload } from "./helpers/watched_events.js";

async function within<Value>(
  promise: Promise<Value>,
  label: string,
): Promise<Value> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${label} timed out`)),
          15_000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

test("Tailwind-shaped inventory uses one directory watch target and indexed required paths", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const root = path.join(fixture.root, "sources");
  const loaded = await loadConfig(fixture.root);
  for (const count of [750, 3_000]) {
    await context.test(`${count} sources`, (sizeContext) => {
      const sources = Array.from(
        { length: count },
        (_, index) => `sources/source-${index}.tsx`,
      );
      let elementReads = 0;
      let counting = false;
      const config = {
        ...loaded,
        sourceFiles: new Proxy(sources, {
          get(target, property, receiver) {
            if (
              counting &&
              typeof property === "string" &&
              /^(?:0|[1-9]\d*)$/.test(property)
            )
              elementReads += 1;
            return Reflect.get(target, property, receiver);
          },
        }),
        postcssWatchDirectories: [{ directory: root, glob: "*.tsx" }],
      };
      const targets = watchTargets(config);
      assert.ok(targets.includes(root));
      assert.ok(
        targets.length < 20,
        `unexpected ${targets.length} watch roots`,
      );
      counting = true;
      for (const source of sources)
        assert.equal(
          isPackageOwnedIgnoredWatchPath(
            path.join(fixture.root, source),
            config,
          ),
          false,
        );
      counting = false;
      assert.equal(
        classifyWatchPath(
          { path: path.join(root, "new.tsx"), kind: "add" },
          config,
        ),
        "rebuild",
      );
      sizeContext.diagnostic(
        `${count} sources: ${elementReads} lookup element reads`,
      );
      assert.ok(elementReads > 0, "source element reads were not counted");
      assert.ok(
        elementReads <= count,
        `${count} sources used ${elementReads} lookup element reads; limit ${count}`,
      );
    });
  }
});

test(
  "a real 3,000-file watched directory becomes ready and reports an added file",
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
    let observe!: () => void;
    const observed = new Promise<void>((resolve) => {
      observe = resolve;
    });
    const gate = new NotificationGate<WatchEvent>((error) => {
      throw error;
    });
    gate.open((event) => {
      if (
        event.path === path.join(root, "new.tsx") &&
        classifyWatchPath(event, config) === "rebuild"
      )
        observe();
    });
    const recordedTargets: string[][] = [];
    const watcherFactory = new ChokidarWatcherFactory();
    const watcher = createSourceWatcher(
      {
        create(targets, ignore, options) {
          recordedTargets.push([...targets]);
          return watcherFactory.create(targets, ignore, options);
        },
      },
      config,
      gate,
    );
    context.after(() => watcher.close());
    await reportDuration(
      "watcher readiness",
      (text) => context.diagnostic(text),
      () => watcher.ready(),
    );
    assert.ok(recordedTargets.flat().includes(root));
    assert.ok(
      !recordedTargets
        .flat()
        .some((target) => target.startsWith(`${root}${path.sep}`)),
      "covered source files must not be watched individually",
    );
    await fs.writeFile(path.join(root, "new.tsx"), "export default null");
    await within(observed, "watch event");
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
    let completed!: () => void;
    const rebuild = new Promise<void>((resolve) => {
      completed = resolve;
    });
    let sourceWatcherCreates = 0;
    const sourceWatcherTargets: string[][] = [];
    const watcherFactory = new ChokidarWatcherFactory();
    class CountingReporter extends PlainServeReporter {
      override watchFinished(report: WatchReport): void {
        actions.push(report.action);
        if (report.action === "rebuild") completed();
      }
    }
    const running = await reportDuration(
      "watched Serve readiness",
      (text) => context.diagnostic(text),
      () =>
        serve(
          config,
          { port: 0, watch: true },
          {
            reporter: new CountingReporter(() => {}),
            watcherFactory: {
              create(targets, ignore, options) {
                if (targets.includes(directory)) {
                  sourceWatcherCreates += 1;
                  sourceWatcherTargets.push([...targets]);
                }
                return watcherFactory.create(targets, ignore, options);
              },
            },
          },
        ),
    );
    fixture.beforeRemove(() => running.close());
    const initialWatcherCreates = sourceWatcherCreates;
    assert.ok(sourceWatcherTargets.flat().includes(directory));
    assert.ok(
      !sourceWatcherTargets
        .flat()
        .some((target) => target.startsWith(`${directory}${path.sep}`)),
      "covered source files must not be watched individually",
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
    await within(rebuild, "rebuild report");
    assert.deepEqual(
      actions.filter((action) => action !== "evidence"),
      ["rebuild"],
    );
    assert.equal(sourceWatcherCreates, initialWatcherCreates);
  },
);
