import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import http, { type ServerResponse } from "node:http";
import path from "node:path";
import type { TestContext } from "node:test";

import { BuildWarningSink } from "../../dist/build/warning_sink.js";
import type { BuildWarning } from "../../dist/build/warnings.js";
import { loadConfig } from "../../dist/config/load.js";
import { PlainServeReporter } from "../../dist/server/reporter.js";
import type { WatchReport } from "../../dist/server/reporter.js";
import { serve, type ServeDependencies } from "../../dist/server/serve.js";

import { createFixture, removeFixture } from "./fixture.js";
import {
  FakeOutputStore,
  FakeSupervisor,
  FakeSupervisorFactory,
  FakeWatcherFactory,
} from "./watch_config.js";

/** Retain events so a fast producer cannot overtake a test's subscription. */
export class WarningJournal {
  readonly events: string[] = [];
  private readonly emitter = new EventEmitter();
  record(event: string): void {
    this.events.push(event);
    this.emitter.emit("event");
  }
  async wait(event: string, after = 0): Promise<void> {
    if (this.events.slice(after).includes(event)) return;
    await new Promise<void>((resolve) => {
      const check = () => {
        if (!this.events.slice(after).includes(event)) return;
        this.emitter.off("event", check);
        resolve();
      };
      this.emitter.on("event", check);
    });
  }
}

/** Each renderer request waits for the test to release that exact call. */
export class WarningRenderGate {
  private closed = false;
  private open = false;
  private readonly requests: Array<{ name: string; response: ServerResponse }> =
    [];
  private readonly journal = new WarningJournal();
  private readonly server = http.createServer((request, response) => {
    const name = request.url!.slice(1);
    this.requests.push({ name, response });
    this.journal.record(name);
    if (this.open) response.end("ok");
  });
  url = "";
  async start(): Promise<void> {
    await new Promise<void>((resolve) =>
      this.server.listen(0, "127.0.0.1", resolve),
    );
    const address = this.server.address();
    assert.ok(address && typeof address !== "string");
    this.url = `http://127.0.0.1:${address.port}`;
  }
  async next(producer: "background" | "preview", after = 0) {
    const names = [`${producer}/desktop`, `${producer}/mobile`];
    if (
      !this.requests
        .slice(after)
        .some((request) => names.includes(request.name))
    )
      await Promise.race(names.map((name) => this.journal.wait(name, after)));
    const index = this.requests.findIndex(
      (request, index) => index >= after && names.includes(request.name),
    );
    assert.ok(index >= 0);
    const request = this.requests[index]!;
    return {
      index,
      name: request.name,
      release: () => request.response.end("ok"),
    };
  }
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      this.server.close((error) => (error ? reject(error) : resolve())),
    );
  }
  releaseAll(): void {
    this.open = true;
    for (const request of this.requests) request.response.end("ok");
  }
}

class ObservedWarningSink extends BuildWarningSink {
  readonly additions: BuildWarning[] = [];
  constructor(
    readonly journal: WarningJournal,
    readonly emitted: BuildWarning[],
  ) {
    super((warning) => {
      emitted.push(warning);
      journal.record("warning");
    });
  }
  override add(warning: BuildWarning): void {
    this.additions.push(warning);
    super.add(warning);
  }
  override reset(): void {
    super.reset();
    this.journal.record("reset");
  }
}

class WarningReporter extends PlainServeReporter {
  constructor(private readonly journal: WarningJournal) {
    super((line) => journal.record(`diagnostic:${line}`));
  }
  override catalogueReady(): void {
    this.journal.record("complete");
  }
  override changesUnavailable(): void {
    this.journal.record("classified");
  }
  override watchFailed(report: WatchReport): void {
    this.journal.record(`failed:${report.action}`);
  }
  override watchFinished(report: WatchReport): void {
    this.journal.record(`finished:${report.action}`);
  }
}

/** A two-view catalogue with real worker warnings and controlled watch events. */
export async function warningFixture(t: TestContext) {
  const fixture = await createFixture(
    `import { defineScreen } from "@mokly/mokly";
export default defineScreen({ path: "home", title: "Home", description: "Home", relatedDocs: [], desktop: <main>Home</main>, mobile: <main>Home</main> });`,
    {
      extraConfig:
        'renderer: "renderer.tsx", colorSchemes: ["light"], watch: { debounceMs: 0 },',
    },
  );
  t.after(() => removeFixture(fixture));
  const gate = new WarningRenderGate();
  await gate.start();
  fixture.beforeRemove(() => gate.close());
  const rendererPath = path.join(fixture.root, "renderer.tsx");
  const renderer = (
    warn: boolean,
  ) => `import { renderToStaticMarkup } from "react-dom/server";
import { workerData } from "node:worker_threads";
import { execFileSync } from "node:child_process";
export default (input) => {
  ${
    warn
      ? `const url = ${JSON.stringify(gate.url)} + "/" + (workerData?.runtime ? "background" : "preview") + "/" + input.viewport;
  execFileSync(process.execPath, ["--input-type=module", "-e", "const response = await fetch(" + JSON.stringify(url) + "); await response.text(); process.exit(0);"], { timeout: 5000 });`
      : ""
  }
  const html = '<html><head></head><body>' + renderToStaticMarkup(input.node) + '</body></html>';
  return ${warn ? '{ html, resources: [{ path: "action.css", componentIds: ["unused"] }] }' : "{ html }"};
};`;
  await fs.writeFile(rendererPath, renderer(true));
  await fs.writeFile(
    path.join(fixture.mockupsDir, "action.css"),
    "main {color: red}",
  );
  const config = await loadConfig(fixture.root);
  const journal = new WarningJournal();
  const emitted: BuildWarning[] = [];
  const sink = new ObservedWarningSink(journal, emitted);
  const watchers = new FakeWatcherFactory();
  return {
    ...fixture,
    config,
    gate,
    journal,
    emitted,
    sink,
    watchers,
    fixRenderer: () => fs.writeFile(rendererPath, renderer(false)),
    async start(provided: Partial<ServeDependencies> = {}) {
      const running = await serve(
        config,
        { port: 0, watch: true },
        {
          changeClassifier: {
            async read() {
              return undefined;
            },
          },
          outputStore: new FakeOutputStore(),
          processSupervisorFactory: new FakeSupervisorFactory(
            new FakeSupervisor(),
          ),
          watcherFactory: watchers,
          reporter: new WarningReporter(journal),
          warnings: sink,
          ...provided,
        },
      );
      fixture.beforeRemove(() => running.close());
      fixture.beforeRemove(() => gate.close());
      return running;
    },
  };
}
