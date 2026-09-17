import assert from "node:assert/strict";
import { fork, type ChildProcess } from "node:child_process";
import path from "node:path";
import test from "node:test";

import type { Compilation } from "../dist/build/compile.js";
import { compileCatalogue } from "../dist/build/compile.js";
import type { GeneratedOutputStore } from "../dist/build/output_store.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { FileSystemConfigLoader, loadConfig } from "../dist/config/load.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import type {
  ChildFactory,
  ChildHandle,
} from "../dist/server/child_process.js";
import type { CatalogueServerFactory } from "../dist/server/factory.js";
import type {
  RunningServer,
  ServerOptions,
} from "../dist/server/http_types.js";
import { serve } from "../dist/server/serve.js";
import {
  ReadyProcessSupervisor,
  type ProcessSupervisor,
  type ProcessSupervisorFactory,
} from "../dist/server/supervisor.js";
import type { ChildCommand } from "../dist/server/update_messages.js";
import type {
  ConsumerWatcher,
  ConsumerWatcherFactory,
} from "../dist/server/watcher.js";

import {
  createFixture,
  removeFixture,
  repositoryRoot,
} from "./helpers/fixture.js";

test(
  "watched child exits when its parent IPC channel disconnects",
  { timeout: 10_000 },
  async (context) => {
    const fixture = await createFixture();
    const config = await loadConfig(fixture.root);
    await writeCompilation(await compileCatalogue(config), config);
    const child = fork(
      path.join(repositoryRoot, "dist/cli/bin.js"),
      [
        "__serve-child",
        "--config",
        fixture.configPath,
        "--port",
        "0",
        "--update-version",
        "1",
      ],
      {
        cwd: fixture.root,
        stdio: ["ignore", "ignore", "ignore", "ipc"],
      },
    );
    context.after(async () => {
      await stopChild(child);
      await removeFixture(fixture);
    });
    const port = await readyPort(child);
    assert.equal((await fetch(`http://127.0.0.1:${port}`)).status, 200);

    child.disconnect();

    assert.equal(await exitsWithin(child, 1_000), 0);
  },
);

test("supervisor reports and clears a child that exits after readiness", async () => {
  const factory = new FakeChildFactory();
  const supervisor = new ReadyProcessSupervisor(factory, ["__serve-child"], 0);
  const failures: Error[] = [];
  supervisor.onUnexpectedExit((error) => failures.push(error));
  const starting = supervisor.start();
  factory.children[0]?.ready(48123);
  await starting;

  factory.children[0]?.exit(17);
  assert.match(failures[0]?.message ?? "", /exited unexpectedly \(17\)/);

  const replacement = supervisor.start();
  factory.children[1]?.ready(48123);
  assert.equal(await replacement, 48123);
  await supervisor.close();
});

test("watched Serve restarts through the action queue after an unexpected child exit", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const supervisor = new ExitingSupervisor();
  const running = await serve(
    config,
    { base: "origin/main", port: 0, watch: true },
    {
      configLoader: new FileSystemConfigLoader(),
      outputStore: new FakeOutputStore(),
      processSupervisorFactory: new FakeSupervisorFactory(supervisor),
      serverFactory: new UnusedServerFactory(),
      watcherFactory: new FakeWatcherFactory(),
    },
  );
  context.after(() => running.close());

  supervisor.exitUnexpectedly();
  const deadline = performance.now() + 5000;
  while (supervisor.restarts === 0 && performance.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(supervisor.restarts, 1);
});

class FakeChildFactory implements ChildFactory {
  readonly children: FakeChild[] = [];

  spawn(_arguments: readonly string[]): ChildHandle {
    const child = new FakeChild();
    this.children.push(child);
    return child;
  }
}

class FakeChild implements ChildHandle {
  private readonly errorCallbacks: Array<(error: Error) => void> = [];
  private readonly exitCallbacks: Array<(code: number | null) => void> = [];
  private readonly messageCallbacks: Array<(message: unknown) => void> = [];

  forceKill(): void {
    this.exit(null);
  }

  onDisconnect(_callback: () => void): void {}

  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback);
  }

  onExit(callback: (code: number | null) => void): void {
    this.exitCallbacks.push(callback);
  }

  onMessage(callback: (message: unknown) => void): void {
    this.messageCallbacks.push(callback);
  }

  send(message: ChildCommand): void {
    if (message.type === "shutdown") queueMicrotask(() => this.exit(0));
  }

  terminate(): void {
    this.exit(null);
  }

  exit(code: number | null): void {
    for (const callback of this.exitCallbacks.splice(0)) callback(code);
  }

  ready(port: number): void {
    for (const callback of this.messageCallbacks) {
      callback({ port, type: "ready" });
    }
  }
}

class ExitingSupervisor implements ProcessSupervisor {
  replaceComponentRuntime(): void {}
  restarts = 0;
  private unexpectedExit: ((error: Error) => void) | undefined;

  async close(): Promise<void> {}

  notifyUpdate(): void {}

  onUnexpectedExit(callback: (error: Error) => void): void {
    this.unexpectedExit = callback;
  }

  async restart(): Promise<number> {
    this.restarts += 1;
    return 48123;
  }

  async start(): Promise<number> {
    return 48123;
  }

  exitUnexpectedly(): void {
    this.unexpectedExit?.(new Error("server child exited unexpectedly (17)"));
  }
}

class FakeSupervisorFactory implements ProcessSupervisorFactory {
  constructor(private readonly supervisor: ProcessSupervisor) {}

  create(
    _binPath: string,
    _baseArguments: readonly string[],
    _requestedPort: number,
  ): ProcessSupervisor {
    return this.supervisor;
  }
}

class FakeOutputStore implements GeneratedOutputStore {
  check(_compilation: Compilation, _config: ResolvedConfig): void {}

  async write(
    _compilation: Compilation,
    _config: ResolvedConfig,
  ): Promise<void> {}
}

class FakeWatcherFactory implements ConsumerWatcherFactory {
  create(_targets: readonly string[]): ConsumerWatcher {
    return new FakeWatcher();
  }
}

class FakeWatcher implements ConsumerWatcher {
  async close(): Promise<void> {}

  onChange(_callback: (path: string) => void): void {}

  onError(_callback: (error: Error) => void): void {}

  async ready(): Promise<void> {}
}

class UnusedServerFactory implements CatalogueServerFactory {
  async start(
    _config: ResolvedConfig,
    _options: ServerOptions,
  ): Promise<RunningServer> {
    throw new Error("watched Serve must not start an in-process server");
  }
}

function readyPort(child: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) =>
      reject(new Error(`child exited before readiness (${String(code)})`)),
    );
    child.on("message", (message) => {
      if (
        typeof message === "object" &&
        message !== null &&
        (message as { type?: unknown }).type === "ready" &&
        Number.isInteger((message as { port?: unknown }).port)
      ) {
        resolve((message as { port: number }).port);
      }
    });
  });
}

function exitsWithin(
  child: ChildProcess,
  milliseconds: number,
): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const onExit = (code: number | null): void => {
      clearTimeout(timer);
      resolve(code);
    };
    const timer = setTimeout(() => {
      child.off("exit", onExit);
      reject(new Error("watched child did not exit after IPC disconnect"));
    }, milliseconds);
    child.once("exit", onExit);
  });
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = exitsWithin(child, 2_000);
  child.kill("SIGTERM");
  await exited;
}
