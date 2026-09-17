import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type { Compilation } from "../dist/build/compile.js";
import type { GeneratedOutputStore } from "../dist/build/output_store.js";
import { FileSystemConfigLoader, loadConfig } from "../dist/config/load.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import type { CatalogueServerFactory } from "../dist/server/factory.js";
import type {
  RunningServer,
  ServerOptions,
} from "../dist/server/http_types.js";
import { serve } from "../dist/server/serve.js";
import type {
  ProcessSupervisor,
  ProcessSupervisorFactory,
} from "../dist/server/supervisor.js";
import { classifyWatchPath } from "../dist/server/watch_events.js";
import { ChokidarWatcherFactory } from "../dist/server/watcher.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("package-owned watch rules precede broad consumer rules", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const broad: ResolvedConfig = {
    ...config,
    stylesheets: [{ match: "**/*.html", stylesheets: ["styles.css"] }],
    watch: {
      debounceMs: 0,
      rules: [{ action: "restart", paths: ["**/*"] }],
    },
  };
  for (const candidate of [
    "node_modules/package/index.js",
    ".context/mokly-review/index.html",
    ".review/index.html",
    "coverage/lcov.info",
    "dist/cli/bin.js",
    "playwright-report/index.html",
    "target/debug/mokly",
    "test-results/results.json",
    ".mokly-review-123/stage/index.html",
    ".mokly-write-123/stage/screen.html",
  ]) {
    assert.equal(
      classifyWatchPath(path.join(fixture.root, candidate), broad),
      "ignore",
      candidate,
    );
  }
  assert.equal(
    classifyWatchPath(path.join(fixture.mockupsDir, "styles.css"), broad),
    "reload",
  );
  const nestedRenderer = path.join(fixture.root, "target/renderer.ts");
  const nestedSources: ResolvedConfig = {
    ...broad,
    entriesDir: path.join(fixture.root, "dist/entries"),
    renderer: nestedRenderer,
  };
  assert.equal(
    classifyWatchPath(
      path.join(nestedSources.entriesDir, "screen.mockup.tsx"),
      nestedSources,
    ),
    "rebuild",
  );
  assert.equal(classifyWatchPath(nestedRenderer, nestedSources), "rebuild");
});

test(
  "broad watch rules do not traverse package-owned dependency trees",
  { timeout: 10_000 },
  async (context) => {
    const fixture = await createFixture();
    await fs.promises.writeFile(
      fixture.configPath,
      'export default { entriesDir: "entries", mockupsDir: "mockups", repoRoot: ".", watch: { debounceMs: 0, rules: [{ action: "restart", paths: ["**/*"] }] } };\n',
    );
    const config = await loadConfig(fixture.root);
    const supervisor = new CountingSupervisor();
    const running = await serve(
      config,
      { port: 0, watch: true },
      {
        configLoader: new FileSystemConfigLoader(),
        outputStore: new FakeOutputStore(),
        processSupervisorFactory: new CountingSupervisorFactory(supervisor),
        serverFactory: new UnusedServerFactory(),
        watcherFactory: new ChokidarWatcherFactory(),
      },
    );
    context.after(async () => {
      await running.close();
      await removeFixture(fixture);
    });
    await fs.promises.writeFile(
      path.join(fixture.root, "consumer-input.txt"),
      "changed\n",
    );
    await waitFor(() => supervisor.restarts === 1);

    const dependency = path.join(fixture.root, "node_modules/package/index.js");
    await fs.promises.mkdir(path.dirname(dependency), { recursive: true });
    await fs.promises.writeFile(dependency, "changed\n");
    await new Promise((resolve) => setTimeout(resolve, 300));

    assert.equal(supervisor.restarts, 1);
  },
);

test(
  "explicit rules watch unowned public HTML beneath mockupsDir",
  { timeout: 10_000 },
  async (context) => {
    const fixture = await createFixture();
    const publicHtml = path.join(fixture.mockupsDir, "static/help.html");
    await fs.promises.mkdir(path.dirname(publicHtml), { recursive: true });
    await fs.promises.writeFile(publicHtml, "<!doctype html><p>Before</p>\n");
    await fs.promises.writeFile(
      fixture.configPath,
      'export default { entriesDir: "entries", mockupsDir: "mockups", repoRoot: ".", watch: { debounceMs: 0, rules: [{ action: "reload", paths: ["mockups/static/**"] }] } };\n',
    );
    const config = await loadConfig(fixture.root);
    assert.equal(classifyWatchPath(publicHtml, config), "reload");
    const supervisor = new CountingSupervisor();
    const running = await serve(
      config,
      { port: 0, watch: true },
      {
        configLoader: new FileSystemConfigLoader(),
        outputStore: new FakeOutputStore(),
        processSupervisorFactory: new CountingSupervisorFactory(supervisor),
        serverFactory: new UnusedServerFactory(),
        watcherFactory: new ChokidarWatcherFactory(),
      },
    );
    context.after(async () => {
      await running.close();
      await removeFixture(fixture);
    });

    await fs.promises.writeFile(publicHtml, "<!doctype html><p>After</p>\n");
    await waitFor(() => supervisor.updates === 1);
  },
);

class FakeOutputStore implements GeneratedOutputStore {
  check(_compilation: Compilation, _config: ResolvedConfig): void {}

  async write(
    _compilation: Compilation,
    _config: ResolvedConfig,
  ): Promise<void> {}
}

class CountingSupervisorFactory implements ProcessSupervisorFactory {
  constructor(private readonly supervisor: ProcessSupervisor) {}

  create(
    _binPath: string,
    _baseArguments: readonly string[],
    _requestedPort: number,
  ): ProcessSupervisor {
    return this.supervisor;
  }
}

class CountingSupervisor implements ProcessSupervisor {
  replaceComponentRuntime(): void {}
  restarts = 0;
  updates = 0;

  async close(): Promise<void> {}

  notifyUpdate(): void {
    this.updates += 1;
  }

  onUnexpectedExit(_callback: (error: Error) => void): void {}

  async restart(): Promise<number> {
    this.restarts += 1;
    return 48123;
  }

  async start(): Promise<number> {
    return 48123;
  }
}

class UnusedServerFactory implements CatalogueServerFactory {
  async start(
    _config: ResolvedConfig,
    _options: ServerOptions,
  ): Promise<RunningServer> {
    throw new Error("watched Serve must not start an in-process server");
  }
}

async function waitFor(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("watch condition did not become true");
}
