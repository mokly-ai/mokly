import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import {
  acquireOutputLock,
  assertOutputLockHeld,
  type OutputLock,
} from "../dist/build/output_lock.js";
import { FileSystemGeneratedOutputStore } from "../dist/build/output_store.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { runWithTimings } from "../dist/diagnostics/timings.js";
import { isCancellation } from "../dist/errors.js";
import { assertInputsUnchanged } from "../dist/export/inputs.js";
import { capturePublicFiles } from "../dist/export/public_files.js";
import { exportCatalogue } from "../dist/export/run.js";
import { PlainServeReporter } from "../dist/server/reporter.js";
import { serve } from "../dist/server/serve.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { screensSource } from "./helpers/generated_output_fixture.js";

/** Run `operation` and resolve `reached` once it starts waiting for the writer lock. */
function observeLockWait<Result>(operation: () => Promise<Result>): {
  readonly reached: Promise<void>;
  readonly result: Promise<Result>;
} {
  let reach!: () => void;
  const reached = new Promise<void>((resolve) => {
    reach = resolve;
  });
  const result = runWithTimings(true, "test", operation, {
    write: (event) => {
      if (event.stage === "output.lock" && event.event === "start") reach();
    },
  });
  return { reached, result };
}

test(
  "Serve close stops a background write that waits for the writer lock",
  { timeout: 30_000 },
  async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    let holder: OutputLock | undefined;
    context.after(() => holder?.release());
    const store = new FileSystemGeneratedOutputStore();
    const failures: unknown[] = [];
    let waiting: ReturnType<typeof observeLockWait<void>> | undefined;
    let began = () => {};
    const writeStarted = new Promise<void>((resolve) => {
      began = resolve;
    });
    const running = await serve(
      config,
      { port: 0, watch: false, build: true },
      {
        reporter: new PlainServeReporter(() => {}),
        outputStore: {
          check: (compilation, candidate) =>
            store.check(compilation, candidate),
          write: async (compilation, candidate, signal) => {
            holder = await acquireOutputLock(config.repoRoot);
            waiting = observeLockWait(() =>
              store.write(compilation, candidate, signal),
            );
            began();
            return waiting.result.catch((error) => {
              failures.push(error);
              throw error;
            });
          },
        },
      },
    );
    let closing: Promise<void> | undefined;
    const close = () => (closing ??= running.close());
    fixture.beforeRemove(close);
    await writeStarted;
    await waiting!.reached;
    await close();
    assert.equal(failures.length, 1);
    assert.ok(isCancellation(failures[0]));
    assertOutputLockHeld(holder!, config.repoRoot);
  },
);

test(
  "cancelled export leaves the unrelated writer lock intact",
  { timeout: 60_000 },
  async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    const holder = await acquireOutputLock(config.repoRoot);
    context.after(() => holder.release());
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      exportCatalogue(config, {
        noChanges: true,
        outDir: "site",
        signal: controller.signal,
      }),
      (error: Error) => isCancellation(error),
    );
    assertOutputLockHeld(holder, config.repoRoot);
    await assert.rejects(fs.access(path.join(fixture.root, "site")), {
      code: "ENOENT",
    });
  },
);

test(
  "export completes while another process holds the writer lock",
  { timeout: 60_000 },
  async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    const holder = await acquireOutputLock(config.repoRoot);
    context.after(() => holder.release());
    let lockSpans = 0;
    const result = await runWithTimings(
      true,
      "test",
      () => exportCatalogue(config, { noChanges: true, outDir: "site" }),
      {
        write: (event) => {
          if (event.stage === "output.lock") lockSpans++;
        },
      },
    );
    assert.equal(lockSpans, 0);
    assertOutputLockHeld(holder, config.repoRoot);
    assert.equal(result.outDir, path.join(fixture.root, "site"));
    await fs.access(path.join(fixture.root, "site", "index.html"));
  },
);

test(
  "export recheck uses memory while a writer replaces generated disk assets",
  { timeout: 60_000 },
  async (context) => {
    const fixture = await createFixture(
      `${screensSource(4, "Recheck")}import "./fixture.css";\n`,
    );
    context.after(() => removeFixture(fixture));
    await fs.writeFile(
      path.join(fixture.entriesDir, "fixture.css"),
      'main{background:url("./mark.png")}',
    );
    await fs.writeFile(path.join(fixture.entriesDir, "mark.png"), "png");
    const compilation = await compileCatalogue(await loadConfig(fixture.root));
    const config = {
      ...(await loadConfig(fixture.root)),
      sourceFiles: compilation.manifest.sourceFiles,
    };
    await writeCompilation(compilation, config);
    const publicFiles = await capturePublicFiles(
      config,
      compilation.outputs,
      compilation.manifest.assetClosure,
    );
    assert.ok(publicFiles.has("mokly-generated/assets/entries/mark.png"));
    const asset = path.join(
      fixture.mockupsDir,
      "mokly-generated/assets/entries/mark.png",
    );
    const writer = await acquireOutputLock(config.repoRoot);
    await fs.rename(asset, `${asset}.backup`);
    context.after(() => writer.release());
    await assertInputsUnchanged(
      config,
      compilation,
      publicFiles,
      undefined,
      [],
      [],
      false,
    );
    assertOutputLockHeld(writer, config.repoRoot);
    await fs.rename(`${asset}.backup`, asset);
    await writer.release();
  },
);
