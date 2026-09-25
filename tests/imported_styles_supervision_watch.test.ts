import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import { exportCatalogue } from "../dist/export/run.js";
import { referencedRoutes } from "../dist/review/asset_references.js";
import { serve } from "../dist/server/serve.js";
import {
  classifyWatchPath,
  type WatchEvent,
} from "../dist/server/watch_events.js";
import { NotificationGate } from "../dist/server/watch_events.js";
import {
  createSourceWatcher,
  ChokidarWatcherFactory,
} from "../dist/server/watcher.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import { version } from "./helpers/watched_catalogue.js";
import { waitForUpdate } from "./helpers/watched_catalogue.js";
import { waitForBrowserReload } from "./helpers/watched_events.js";

test(
  "real chokidar watcher sees an inventoried source below dist",
  { timeout: 15_000 },
  async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const file = path.join(fixture.root, "packages/ui/dist/component.css");
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, ".a{}");
    const config = {
      ...(await loadConfig(fixture.root)),
      sourceFiles: ["packages/ui/dist/component.css"],
    };
    let changed!: (value: string) => void;
    const observed = new Promise<string>((resolve) => {
      changed = resolve;
    });
    const gate = new NotificationGate<WatchEvent>((error) => {
      throw error;
    });
    gate.open((event) => {
      if (event.path === file && classifyWatchPath(event, config) === "rebuild")
        changed(event.path);
    });
    const watcher = createSourceWatcher(
      new ChokidarWatcherFactory(),
      config,
      gate,
    );
    context.after(() => watcher.close());
    await watcher.ready();
    await fs.writeFile(file, ".b{}");
    assert.equal(
      await Promise.race([
        observed,
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("watch event timed out")), 9000),
        ),
      ]),
      file,
    );
  },
);

test(
  "watched stateful PostCSS removes obsolete rules after a source edit",
  { timeout: 60_000 },
  async (context) => {
    const fixture = await changedFixture(
      context,
      undefined,
      {
        extraConfig: 'postcss: "postcss.config.mjs", watch: { debounceMs: 0 },',
      },
      async (candidate) => {
        await fs.writeFile(
          path.join(candidate.entriesDir, "fixture.css"),
          ".underline{color:red}",
        );
        await fs.appendFile(candidate.entryPath, '\nimport "./fixture.css";');
        const packageRoot = path.join(
          candidate.root,
          "node_modules",
          "stateful-postcss",
        );
        await fs.mkdir(packageRoot, { recursive: true });
        await fs.writeFile(
          path.join(packageRoot, "package.json"),
          '{"type":"module","exports":"./index.mjs"}',
        );
        await fs.writeFile(
          path.join(packageRoot, "index.mjs"),
          'const seen = new Set(); export default () => ({ postcssPlugin: "stateful", Once(root) { root.walkRules(rule => seen.add(rule.selector)); for (const selector of seen) if (!root.nodes.some(node => node.selector === selector)) root.append({ selector, nodes: [{ prop: "color", value: "red" }] }); } });',
        );
        await fs.writeFile(
          path.join(candidate.root, "postcss.config.mjs"),
          'import plugin from "stateful-postcss"; export default { plugins: [plugin()] };',
        );
      },
    );
    const running = await serve(fixture.config, { port: 0, watch: true });
    fixture.beforeRemove(() => running.close());
    const stylesheet = `${running.url}/static/mokly-generated/styles/entries/fixture.mockup.tsx.css`;
    assert.match(
      await fetch(stylesheet).then((response) => response.text()),
      /\.underline/,
    );
    const before = version(
      await fetch(running.url).then((response) => response.text()),
    );
    await waitForBrowserReload(running.url, before, () =>
      fs.writeFile(
        path.join(fixture.entriesDir, "fixture.css"),
        ".italic{color:blue}",
      ),
    );
    await waitForUpdate(running.url, before);
    let next = "";
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      next = await fetch(stylesheet).then((response) => response.text());
      if (next.includes(".italic")) break;
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    assert.match(next, /\.italic/);
    assert.doesNotMatch(next, /\.underline/);
  },
);

test(
  "watched Serve carries large opaque assets and external protocol-relative CSS",
  { timeout: 60_000 },
  async (context) => {
    const asset = Buffer.alloc(4 * 1024 * 1024 + 125, 173);
    const fixture = await changedFixture(
      context,
      undefined,
      { extraConfig: "watch: { debounceMs: 0 }," },
      async (candidate) => {
        await fs.writeFile(
          path.join(candidate.entriesDir, "fixture.css"),
          '.entry{background:url("./large.png");mask:url("//cdn.example.test/mask.svg")}',
        );
        await fs.writeFile(path.join(candidate.entriesDir, "large.png"), asset);
        await fs.appendFile(candidate.entryPath, '\nimport "./fixture.css";');
      },
    );
    const running = await serve(fixture.config, { port: 0, watch: true });
    fixture.beforeRemove(() => running.close());
    const css = await fetch(
      `${running.url}/static/mokly-generated/styles/entries/fixture.mockup.tsx.css`,
    ).then((response) => response.text());
    assert.deepEqual(
      referencedRoutes(
        "mokly-generated/styles/entries/fixture.mockup.tsx.css",
        css,
      ),
      ["mokly-generated/assets/entries/large.png"],
    );
    const response = await fetch(
      `${running.url}/static/mokly-generated/assets/entries/large.png`,
    );
    const received: ArrayBuffer = await response.arrayBuffer();
    assert.deepEqual(Buffer.from(received), asset);
    await exportCatalogue(fixture.config, { outDir: "site", noChanges: true });
  },
);
