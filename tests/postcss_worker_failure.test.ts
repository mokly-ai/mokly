import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { Worker } from "node:worker_threads";

import { compileCatalogue } from "../dist/build/compile.js";
import { IsolatedPostcssProcessor } from "../dist/build/styles/isolated_postcss.js";
import { WorkerRequests } from "../dist/build/styles/worker_requests.js";
import { loadConfig } from "../dist/config/load.js";
import { serve } from "../dist/server/serve.js";

import { removeFixture } from "./helpers/fixture.js";
import { styleFixture } from "./helpers/imported_styles_fixture.js";

async function pluginFixture(
  context: { after(callback: () => Promise<void>): void },
  body: string,
) {
  const fixture = await styleFixture(".first{color:red}", {
    extraConfig: 'postcss: "postcss.config.mjs", watch: { debounceMs: 0 },',
  });
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "postcss.config.mjs"),
    `export default { plugins: [{ postcssPlugin: "failure-fixture", Once(root) { ${body} } }] };`,
  );
  return { fixture, config: await loadConfig(fixture.root) };
}

async function bounded<T>(work: Promise<T>): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("worker request hung")), 2_000),
    ),
  ]);
}

test("synchronous PostCSS plugin errors return the plugin diagnostic", async (context) => {
  const { fixture, config } = await pluginFixture(
    context,
    'throw new Error("synchronous failure")',
  );
  const processor = new IsolatedPostcssProcessor(config);
  context.after(() => processor.close());
  await processor.start();
  await assert.rejects(
    bounded(
      processor.process(path.join(fixture.entriesDir, "fixture.css"), ".x{}"),
    ),
    /PostCSS plugin failure-fixture failed.*synchronous failure/,
  );
});

for (const [name, body, expected] of [
  [
    "late exception",
    'setTimeout(() => { throw new Error("late boom") }, 10)',
    /PostCSS worker for postcss.config.mjs stopped unexpectedly \(error: late boom\)/,
  ],
  [
    "exit zero",
    "process.exit(0)",
    /PostCSS worker for postcss.config.mjs stopped unexpectedly \(exit code 0\)/,
  ],
] as const) {
  test(`${name} rejects pending and future worker requests promptly`, async (context) => {
    const { fixture, config } = await pluginFixture(context, body);
    const processor = new IsolatedPostcssProcessor(config);
    context.after(() => processor.close());
    await processor.start();
    const source = path.join(fixture.entriesDir, "fixture.css");
    if (name === "late exception") {
      await bounded(processor.process(source, ".first{}"));
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    await assert.rejects(
      bounded(processor.process(source, ".second{}")),
      expected,
    );
    await assert.rejects(
      bounded(processor.process(source, ".third{}")),
      expected,
    );
  });
}

test(
  "watched Serve closes after a PostCSS worker exits during rebuild",
  { timeout: 20_000 },
  async (context) => {
    const { fixture, config } = await pluginFixture(
      context,
      'if (root.toString().includes(".crash")) process.exit(0)',
    );
    const running = await bounded(serve(config, { port: 0, watch: true }));
    context.after(() => running.close());
    await fs.writeFile(
      path.join(fixture.entriesDir, "fixture.css"),
      ".crash{color:red}",
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    await bounded(running.close());
    assert.ok(true);
  },
);

test("Build fails promptly when a PostCSS worker exits zero", async (context) => {
  const { config } = await pluginFixture(context, "process.exit(0)");
  await assert.rejects(
    bounded(compileCatalogue(config)),
    /PostCSS worker for postcss.config.mjs stopped unexpectedly \(exit code 0\); check the plugin and rebuild/,
  );
});

test("worker messageerror rejects pending and subsequent requests", async () => {
  class FakeWorker extends EventEmitter {
    postMessage(): void {}
    terminate(): Promise<number> {
      return Promise.resolve(0);
    }
  }
  const worker = new FakeWorker();
  const requests = new WorkerRequests<{ css: string }>(
    worker as unknown as Worker,
    "plugin.mjs",
  );
  worker.emit("message", { id: 0 });
  await requests.start();
  const pending = requests.request({ text: ".x{}" });
  worker.emit("messageerror", new Error("bad clone"));
  await assert.rejects(
    pending,
    /PostCSS worker for plugin.mjs stopped unexpectedly \(messageerror: bad clone\)/,
  );
  await assert.rejects(
    requests.request({ text: ".y{}" }),
    /messageerror: bad clone/,
  );
  await requests.close();
});
