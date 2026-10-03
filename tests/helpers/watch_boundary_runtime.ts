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
} from "../../dist/server/supervisor_types.js";

export class FakeOutputStore implements GeneratedOutputStore {
  check(_compilation: Compilation, _config: ResolvedConfig): void {}

  async write(
    _compilation: Compilation,
    _config: ResolvedConfig,
  ): Promise<void> {}
}

export class CountingSupervisorFactory implements ProcessSupervisorFactory {
  constructor(private readonly supervisor: ProcessSupervisor) {}

  create(
    _binPath: string,
    _baseArguments: readonly string[],
    _requestedPort: number,
  ): ProcessSupervisor {
    return this.supervisor;
  }
}

export class CountingSupervisor implements ProcessSupervisor {
  replaceComponentRuntime(): void {}
  restarts = 0;
  updates = 0;
  private version = 0;

  currentUpdateVersion(): number {
    return Math.max(1, this.version);
  }

  publishRebuildStatus(): void {}

  reserveUpdateVersion(): number {
    return ++this.version;
  }

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

export class UnusedServerFactory implements CatalogueServerFactory {
  async start(
    _config: ResolvedConfig,
    _options: ServerOptions,
  ): Promise<RunningServer> {
    throw new Error("watched Serve must not start an in-process server");
  }
}
