import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { Compilation } from "../dist/build/compile.js";
import type { GeneratedOutputStore } from "../dist/build/output_store.js";
import { watchBuild } from "../dist/cli/build_watch.js";
import { PlainReporter } from "../dist/cli/reporter/plain.js";
import { loadConfig } from "../dist/config/load.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";
import { styleFixture } from "./helpers/imported_styles_fixture.js";
import { ResourceWatcherFactory } from "./helpers/resource_watcher.js";
import { memoryTerminal } from "./helpers/terminal.js";
import { waitFor } from "./server_fixture.js";

test("watched Build inventories PostCSS scan roots before source readiness", async (t) => {
  const fixture = await styleFixture(".example { color: blue }", {
    extraConfig: 'postcss: "postcss.config.mjs",',
  });
  t.after(() => removeFixture(fixture));
  const content = path.join(fixture.root, "content");
  await fs.mkdir(content);
  await fs.writeFile(
    path.join(fixture.root, "postcss.config.mjs"),
    `export default {
    plugins: [{ postcssPlugin: "scan", Once(root, { result }) {
      result.messages.push({ type: "dir-dependency", plugin: "scan", dir: ${JSON.stringify(content)}, glob: "**/*.txt" });
    } }]
  };`,
  );
  const watchers = new ResourceWatcherFactory();
  const store = new RecordingStore();
  const terminal = memoryTerminal({ isTTY: false });
  await watchBuild(
    await loadConfig(fixture.root),
    fixture.root,
    new StopReporter(terminal.environment),
    watchers,
    store,
  );
  assert.equal(store.compilations.length, 1, terminal.stderr());
  assert.ok(
    watchers.watchers[0]?.targets.includes(content),
    "the initial source watcher must include the reported scan root",
  );
  assert.ok(watchers.watchers.every((watcher) => watcher.closeCount === 1));
});

test("watched Build flushes initial edits when adopting new source targets", async (t) => {
  const source =
    validEntrySource({ body: "<span>{word}</span>" }) +
    '\nimport { word } from "../shared.ts";\n';
  const fixture = await createFixture(source, {
    extraConfig: "watch: { debounceMs: 0 },",
  });
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "shared.ts"),
    'export const word = "Before";',
  );
  const watchers = new ResourceWatcherFactory();
  const store = new RecordingStore();
  const terminal = memoryTerminal({ isTTY: false });
  let reports = 0;
  const reporter = new PlainReporter(terminal.environment);
  reporter.summary = () => {
    reports++;
  };
  store.onWrite = async () => {
    if (store.compilations.length !== 1) return;
    await fs.writeFile(
      fixture.entryPath,
      source.replaceAll("<span>{word}</span>", "<span>After {word}</span>"),
    );
    watchers.watchers[0]!.change(fixture.entryPath);
  };
  const watching = watchBuild(
    await loadConfig(fixture.root),
    fixture.root,
    reporter,
    watchers,
    store,
  );
  try {
    await waitFor(async () => reports === 2);
    assert.match(
      String(store.compilations[1]?.outputs.get("home/index.mobile.html")),
      /After [\s\S]*Before/,
    );
    assert.equal(terminal.stderr(), "");
  } finally {
    process.emit("SIGTERM");
    await watching;
  }
  assert.ok(watchers.watchers.every((watcher) => watcher.closeCount === 1));
});

test("watched Build attaches referenced HTML, PDF and nested CSS before writing", async (t) => {
  const fixture = await createFixture(
    validEntrySource({
      body: '<a href="../../guide.html">Guide</a><a href="../../spec.pdf">PDF</a>',
    }),
  );
  t.after(() => removeFixture(fixture));
  for (const [name, value] of [
    ["guide.html", '<link rel="stylesheet" href="guide.css"><p>Guide</p>'],
    ["guide.css", "p { color: blue }"],
    ["spec.pdf", "%PDF-1.4\nfixture"],
  ])
    await fs.writeFile(path.join(fixture.mockupsDir, name!), value!);
  const watchers = new ResourceWatcherFactory();
  const ready = new Set<unknown>();
  watchers.onReady = async (watcher) => {
    ready.add(watcher);
  };
  const store = new RecordingStore();
  let captured: string[] = [];
  store.onWrite = async () => {
    captured = ["guide.html", "guide.css", "spec.pdf"].filter((name) =>
      watchers.watchers.some(
        (watcher) =>
          ready.has(watcher) &&
          watcher.options?.followSymlinks === false &&
          watcher.ignore?.(path.join(fixture.mockupsDir, name)) === false,
      ),
    );
  };
  const terminal = memoryTerminal({ isTTY: false });
  await watchBuild(
    await loadConfig(fixture.root),
    fixture.root,
    new StopReporter(terminal.environment),
    watchers,
    store,
  );
  assert.equal(store.compilations.length, 1, terminal.stderr());
  assert.deepEqual(captured, ["guide.html", "guide.css", "spec.pdf"]);
  assert.ok(watchers.watchers.every((watcher) => watcher.closeCount === 1));
});

class RecordingStore implements GeneratedOutputStore {
  readonly compilations: Compilation[] = [];
  onWrite: () => Promise<void> = async () => {};
  check(): void {}
  async write(compilation: Compilation): Promise<void> {
    this.compilations.push(compilation);
    await this.onWrite();
  }
}

class StopReporter extends PlainReporter {
  override summary(plain: string, rich: string, durationMs: number): void {
    super.summary(plain, rich, durationMs);
    process.emit("SIGTERM");
  }
  override runtimeDiagnostic(error: unknown): void {
    super.runtimeDiagnostic(error);
    process.emit("SIGTERM");
  }
}
