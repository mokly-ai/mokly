import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import type { ManifestV9 } from "@mokly/viewer/data";

import type { Compilation } from "../../dist/build/compile.js";
import { watchBuild } from "../../dist/cli/build_watch.js";
import { PlainReporter } from "../../dist/cli/reporter/plain.js";
import { loadConfig } from "../../dist/config/load.js";
import { PlainServeReporter } from "../../dist/server/reporter.js";
import { serve } from "../../dist/server/serve.js";
import type { WatchEvent } from "../../dist/server/watch_events.js";
import { waitFor } from "../server_fixture.js";

import { createFixture, removeFixture, validEntrySource } from "./fixture.js";
import { ResourceWatcherFactory } from "./resource_watcher.js";
import { memoryTerminal } from "./terminal.js";
import { FakeSupervisor, FakeSupervisorFactory } from "./watch_config.js";

export type WatchedCommand = "Build" | "Serve";

/** Identical authored graph and resources exercised through both command owners. */
export async function watchMatrixFixture(t: TestContext) {
  const fixture = await createFixture(
    validEntrySource({
      body: '<span>{label}</span><a href="../../guide.html">Guide</a><a href="../../guide.pdf">PDF</a>',
    }) + '\nimport { label } from "../shared.ts";\nimport "./entry.css";\n',
    {
      extraConfig:
        'watch: { debounceMs: 0 }, postcss: "postcss.config.mjs", stylesheets: [{ match: "**", stylesheets: ["public.css"] }],',
    },
  );
  t.after(() => removeFixture(fixture));
  await fs.mkdir(path.join(fixture.root, "content"));
  for (const [name, bytes] of Object.entries({
    "shared.ts": 'export const label = "Original label";',
    "entries/entry.css": ".entry{color:blue}",
    "content/first.txt": "alpha",
    "mockups/public.css": '@import "nested.css";',
    "mockups/nested.css": "main{color:purple}",
    "mockups/guide.html":
      '<link rel="stylesheet" href="guide.css"><p>Guide</p>',
    "mockups/guide.css": "p{color:green}",
    "mockups/guide.pdf": "%PDF-1.4\noriginal",
    "mockups/alternate.css": "main{color:red}",
    "postcss.config.mjs": `import fs from "node:fs";import path from "node:path";
      const dir = ${JSON.stringify(path.join(fixture.root, "content"))};
      export default { plugins: [{ postcssPlugin: "scan", Once(root, { result }) {
        result.messages.push({ type: "dir-dependency", plugin: "scan", dir, glob: "**/*.txt" });
        const words = fs.readdirSync(dir).filter(x=>x.endsWith(".txt")).sort().map(x=>fs.readFileSync(path.join(dir,x),"utf8")).join(" ");
        root.append({ selector: ".scan", nodes: [{ prop: "--words", value: JSON.stringify(words) }] });
      } }] };`,
  }))
    await fs.writeFile(path.join(fixture.root, name), bytes);
  return fixture;
}

/** Keep real compilation and resource discovery while capturing IO boundaries. */
export async function startWatchMatrix(
  command: WatchedCommand,
  fixture: Awaited<ReturnType<typeof watchMatrixFixture>>,
) {
  const factory = new ResourceWatcherFactory();
  const writes: Compilation[] = [];
  const accepted: ManifestV9[] = [];
  const diagnostics: unknown[] = [];
  const store = {
    check() {},
    async write(compilation: Compilation) {
      writes.push(compilation);
    },
  };
  const config = await loadConfig(fixture.root);
  let close: () => Promise<void>;
  if (command === "Build") {
    const terminal = memoryTerminal({ isTTY: false });
    const reporter = new PlainReporter(terminal.environment);
    reporter.summary = () => {
      accepted.push(writes.at(-1)!.manifest);
    };
    reporter.runtimeDiagnostic = (error) => {
      diagnostics.push(error);
    };
    const running = watchBuild(config, fixture.root, reporter, factory, store);
    close = async () => {
      process.emit("SIGTERM");
      await running;
    };
  } else {
    const supervisor = new MatrixSupervisor(accepted);
    const reporter = new PlainServeReporter((error) => diagnostics.push(error));
    const running = await serve(
      config,
      { port: 0, watch: true, build: true },
      {
        watcherFactory: factory,
        outputStore: store,
        reporter,
        processSupervisorFactory: new FakeSupervisorFactory(supervisor),
        changeClassifier: {
          async read(_config, manifest) {
            return { baseline: manifest };
          },
        },
      },
    );
    close = () => running.close();
  }
  fixture.beforeRemove(close);
  await waitFor(async () => accepted.length > 0);
  const observing = (file: string) =>
    factory.watchers.filter(
      (watcher) =>
        !watcher.closeCount &&
        watcher.ignore?.(file) !== true &&
        watcher.targets.some(
          (root) => file === root || file.startsWith(root + path.sep),
        ),
    );
  return {
    accepted,
    diagnostics,
    factory,
    writes,
    async close() {
      await close();
      assert.ok(factory.watchers.every((watcher) => watcher.closeCount === 1));
    },
    observing,
    notify(file: string, kind: WatchEvent["kind"] = "change") {
      const watchers = observing(file);
      assert.ok(watchers.length, `No ${command} observer for ${file}`);
      for (const watcher of watchers) watcher.emit({ path: file, kind });
    },
    async next(before: number) {
      await waitFor(async () => accepted.length > before);
    },
  };
}

class MatrixSupervisor extends FakeSupervisor {
  constructor(private readonly accepted: ManifestV9[]) {
    super();
  }
  completeCatalogue(manifest: ManifestV9): void {
    this.accepted.push(manifest);
  }
}
