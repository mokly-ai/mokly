import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { setImmediate } from "node:timers/promises";

import { compileCatalogue } from "../dist/build/compile.js";
import {
  acquireOutputLock,
  assertOutputLockHeld,
} from "../dist/build/output_lock.js";
import { FileSystemGeneratedOutputStore } from "../dist/build/output_store.js";
import { IsolatedPostcssProcessor } from "../dist/build/styles/isolated_postcss.js";
import { watchBuild } from "../dist/cli/build_watch.js";
import { PlainReporter } from "../dist/cli/reporter/plain.js";
import { loadConfig } from "../dist/config/load.js";
import { runWithTimings } from "../dist/diagnostics/timings.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";
import { styleFixture } from "./helpers/imported_styles_fixture.js";
import { ResourceWatcherFactory } from "./helpers/resource_watcher.js";
import { memoryTerminal } from "./helpers/terminal.js";
import { waitFor } from "./server_fixture.js";

for (const signalName of ["SIGINT", "SIGTERM"] as const) {
  test(`${signalName} aborts initial watched compilation before the blocked plugin is released`, async (t) => {
    const fixture = await styleFixture(".entry{color:blue}", {
      extraConfig: 'postcss: "postcss.config.mjs",',
    });
    t.after(() => removeFixture(fixture));
    const started = path.join(fixture.root, "started");
    const release = path.join(fixture.root, "release");
    await fs.writeFile(
      path.join(fixture.root, "postcss.config.mjs"),
      `import fs from "node:fs/promises";
      import { setTimeout } from "node:timers/promises";
      export default { plugins: [{ postcssPlugin: "blocked", async Once() {
        await fs.writeFile(${JSON.stringify(started)}, "ready");
        while (!(await fs.access(${JSON.stringify(release)}).then(()=>true,()=>false))) await setTimeout(10);
      } }] };`,
    );
    const config = await loadConfig(fixture.root);
    let closeRequested = false;
    const original = IsolatedPostcssProcessor.prototype.close;
    t.mock.method(
      IsolatedPostcssProcessor.prototype,
      "close",
      async function (this: IsolatedPostcssProcessor) {
        closeRequested = true;
        await original.call(this);
      },
    );
    let writes = 0;
    const terminal = memoryTerminal({ isTTY: false });
    const watchers = new ResourceWatcherFactory();
    const running = watchBuild(
      config,
      fixture.root,
      new PlainReporter(terminal.environment),
      watchers,
      {
        check() {},
        async write() {
          writes++;
        },
      },
    );
    try {
      await waitFor(async () =>
        fs.access(started).then(
          () => true,
          () => false,
        ),
      );
      assert.equal(closeRequested, false);
      process.emit(signalName);
      await setImmediate();
      assert.equal(
        closeRequested,
        true,
        "shutdown must close the active processor before releasing its plugin",
      );
      await running;
      assert.equal(writes, 0);
      assert.equal(terminal.stdout(), "");
      assert.equal(terminal.stderr(), "");
    } finally {
      await fs.writeFile(release, "release");
      process.emit(signalName);
      await running;
    }
    assert.ok(watchers.watchers.every((watcher) => watcher.closeCount === 1));
  });

  test(`${signalName} aborts the watched writer wait while the foreign lock remains held`, async (t) => {
    const fixture = await createFixture();
    t.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    const store = new FileSystemGeneratedOutputStore();
    await store.write(await compileCatalogue(config), config);
    const manifest = path.join(fixture.generatedDir, "mokly-manifest.json");
    const before = await fs.readFile(manifest);
    await fs.writeFile(
      fixture.entryPath,
      validEntrySource({ body: "Late candidate" }),
    );
    const holder = await acquireOutputLock(config.repoRoot);
    let captured: AbortSignal | undefined;
    let reach: () => void = () => {};
    const waiting = new Promise<void>((resolve) => {
      reach = resolve;
    });
    const terminal = memoryTerminal({ isTTY: false });
    const running = watchBuild(
      config,
      fixture.root,
      new PlainReporter(terminal.environment),
      new ResourceWatcherFactory(),
      {
        check: (compilation, candidate) => store.check(compilation, candidate),
        write: (compilation, candidate, signal) => {
          captured = signal;
          return runWithTimings(
            true,
            "test",
            () => store.write(compilation, candidate, signal),
            {
              write: (event) => {
                if (event.stage === "output.lock" && event.event === "start")
                  reach();
              },
            },
          );
        },
      },
    );
    try {
      await waiting;
      process.emit(signalName);
      assert.equal(
        captured?.aborted,
        true,
        "the active writer must receive the shutdown signal",
      );
      await running;
      assertOutputLockHeld(holder, config.repoRoot);
      assert.deepEqual(await fs.readFile(manifest), before);
      assert.equal(terminal.stdout(), "");
      assert.equal(terminal.stderr(), "");
    } finally {
      await holder.release();
      process.emit(signalName);
      await running;
    }
  });
}
