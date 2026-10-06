import type { Compilation } from "../../packages/mokly/dist/build/compile.js";
import type { GeneratedOutputStore } from "../../packages/mokly/dist/build/output_store.js";
import type { ResolvedConfig } from "../../packages/mokly/dist/config/types.js";
import type { CatalogueServerFactory } from "../../packages/mokly/dist/server/factory.js";
import type {
  RunningServer,
  ServerOptions,
} from "../../packages/mokly/dist/server/http_types.js";
import type {
  ProcessSupervisor,
  ProcessSupervisorFactory,
} from "../../packages/mokly/dist/server/supervisor.js";

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

export async function waitFor(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("watch condition did not become true");
}
