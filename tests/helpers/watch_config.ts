import type { Compilation } from "../../dist/build/compile.js";
import type { GeneratedOutputStore } from "../../dist/build/output_store.js";
import type { ResolvedConfig } from "../../dist/config/types.js";
import type { CatalogueServerFactory } from "../../dist/server/factory.js";
import type {
  RunningServer,
  ServerOptions,
} from "../../dist/server/http_types.js";
import type {
  ProcessSupervisor,
  ProcessSupervisorFactory,
} from "../../dist/server/supervisor.js";
import type { WatchEvent } from "../../dist/server/watch_events.js";
import type {
  ConsumerWatcher,
  ConsumerWatcherFactory,
} from "../../dist/server/watcher.js";

/** Return one replacement config and count configuration reloads. */
export class FakeConfigLoader {
  loads = 0;

  constructor(private readonly config: ResolvedConfig) {}

  async load(_configPath: string): Promise<ResolvedConfig> {
    this.loads += 1;
    return this.config;
  }
}

/** Capture adopted output and inject transactional write failures. */
export class FakeOutputStore implements GeneratedOutputStore {
  readonly configs: ResolvedConfig[] = [];
  failNext = false;

  check(_compilation: Compilation, _config: ResolvedConfig): void {}

  async write(
    _compilation: Compilation,
    config: ResolvedConfig,
  ): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("candidate config output failed");
    }
    this.configs.push(config);
  }
}

/** Create observable watchers, capture their roots, and inject readiness failures. */
export class FakeWatcherFactory implements ConsumerWatcherFactory {
  readonly targets: string[][] = [];
  readonly watchers: FakeWatcher[] = [];
  failNext = false;

  create(targets: readonly string[]): ConsumerWatcher {
    this.targets.push([...targets]);
    const watcher = new FakeWatcher(this.failNext);
    this.failNext = false;
    this.watchers.push(watcher);
    return watcher;
  }
}

/** Deliver typed changes while retaining observable close state. */
export class FakeWatcher implements ConsumerWatcher {
  closed = false;
  private changeCallback: ((event: WatchEvent) => void) | undefined;
  constructor(private readonly failReady = false) {}

  async close(): Promise<void> {
    this.closed = true;
  }

  onChange(callback: (event: WatchEvent) => void): void {
    this.changeCallback = callback;
  }

  onError(_callback: (error: Error) => void): void {}

  async ready(): Promise<void> {
    if (this.failReady) throw new Error("candidate watcher failed");
  }

  change(candidate: string): void {
    this.changeCallback?.({ path: candidate, kind: "change" });
  }
}

/** Return the controlled supervisor and capture its child arguments. */
export class FakeSupervisorFactory implements ProcessSupervisorFactory {
  baseArguments: string[] = [];

  constructor(private readonly supervisor: ProcessSupervisor) {}

  create(
    _binPath: string,
    baseArguments: readonly string[],
    _requestedPort: number,
  ): ProcessSupervisor {
    this.baseArguments = [...baseArguments];
    return this.supervisor;
  }
}

/** Count child restarts without creating a process. */
export class FakeSupervisor implements ProcessSupervisor {
  replaceComponentRuntime(): void {}
  restarts = 0;

  async close(): Promise<void> {}

  notifyUpdate(): void {}

  onUnexpectedExit(_callback: (error: Error) => void): void {}

  async restart(): Promise<number> {
    this.restarts += 1;
    return 48123;
  }

  async start(): Promise<number> {
    return 48123;
  }
}

/** Reject accidental in-process server startup in watched tests. */
export class UnusedServerFactory implements CatalogueServerFactory {
  async start(
    _config: ResolvedConfig,
    _options: ServerOptions,
  ): Promise<RunningServer> {
    throw new Error("watched Serve must not start an in-process server");
  }
}
