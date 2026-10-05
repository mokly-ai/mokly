import fs from "node:fs/promises";
import path from "node:path";

import { viewRoute } from "@mokly/viewer/data";

import { prepareLiveRuntime } from "../../dist/build/live_runtime.js";
import { loadConfig } from "../../dist/config/load.js";
import type {
  InteractiveBundle,
  InteractiveBundleRequest,
  InteractiveBundler,
} from "../../dist/interactive/bundle.js";
import { NodeInteractiveServerFactory } from "../../dist/interactive/server.js";
import { startCatalogueServer } from "../../dist/server/http.js";

import {
  createFixture,
  type TestFixture,
  validEntrySource,
} from "./fixture.js";
import { replaceRequired } from "./required_replacement.js";

interface PendingBundle {
  reject(error: unknown): void;
  resolve(bundle: InteractiveBundle): void;
}

/** Deterministic bundle boundary for listener state and coalescing tests. */
export class ControlledInteractiveBundler implements InteractiveBundler {
  readonly invalidated: string[] = [];
  readonly requests: InteractiveBundleRequest[] = [];
  private readonly pending = new Map<string, PendingBundle>();

  build(request: InteractiveBundleRequest): Promise<InteractiveBundle> {
    this.requests.push(request);
    return new Promise((resolve, reject) => {
      this.pending.set(request.generation, { reject, resolve });
    });
  }

  fail(generation: string, error: unknown): void {
    this.requirePending(generation).reject(error);
  }

  invalidate(generation: string): void {
    this.invalidated.push(generation);
  }

  succeed(
    generation: string,
    code = "globalThis.__moklyLiveTest = true;",
    emittedGeneration = generation,
  ): void {
    this.requirePending(generation).resolve({
      code,
      generation: emittedGeneration,
    });
  }

  private requirePending(generation: string): PendingBundle {
    const pending = this.pending.get(generation);
    if (!pending) throw new Error(`No pending Live bundle for ${generation}`);
    this.pending.delete(generation);
    return pending;
  }
}

/** Real app and Live listeners backed by an on-demand fixture runtime. */
export async function interactiveServerFixture(
  options: {
    appOrigin?: string;
    interactiveOrigin?: string;
    interactivePort?: number;
    mode?: "off" | "serve";
    port?: number;
    source?: string;
    strictPort?: boolean;
  } = {},
) {
  const mode = options.mode ?? "serve";
  const fixture = await createFixture(options.source ?? validEntrySource(), {
    extraConfig: `interactive: ${JSON.stringify(mode)},`,
  });
  await fs.writeFile(
    path.join(fixture.mockupsDir, "asset.css"),
    "body { color: rebeccapurple; }\n",
  );
  const config = await loadConfig(fixture.root);
  const runtime = await prepareLiveRuntime(config);
  const bundler = new ControlledInteractiveBundler();
  const diagnostics: unknown[] = [];
  let server: Awaited<ReturnType<typeof startCatalogueServer>>;
  try {
    server = await startCatalogueServer(runtime.config, {
      ...(options.appOrigin ? { appOrigin: options.appOrigin } : {}),
      base: "main",
      changesStatus: "unavailable",
      componentRuntime: runtime,
      ...(options.interactiveOrigin
        ? { interactiveOrigin: options.interactiveOrigin }
        : {}),
      ...(options.interactivePort !== undefined
        ? { interactivePort: options.interactivePort }
        : {}),
      interactiveServerFactory: new NodeInteractiveServerFactory(bundler),
      manifest: runtime.manifest,
      onDiagnostic: (error) => diagnostics.push(error),
      port: options.port ?? 0,
      ...(options.strictPort ? { strictPort: true } : {}),
    });
  } catch (error) {
    await fixture.remove();
    throw error;
  }
  fixture.beforeRemove(() => server.close());
  const home = runtime.manifest.entries.find((entry) => entry.path === "home");
  if (home?.kind !== "screen")
    throw new Error("Interactive fixture Home screen is missing");
  return {
    bundler,
    diagnostics,
    fixture,
    generation: runtime.generation,
    liveUrl:
      server.interactivePort === undefined
        ? undefined
        : `http://127.0.0.1:${String(server.interactivePort)}`,
    mobileRoute: viewRoute(home.path, "mobile", "light"),
    runtime,
    server,
  };
}

/** Opt out only the fixture Home screen while keeping other views eligible. */
export function optedOutFixtureSource(source = validEntrySource()): string {
  return replaceRequired(
    source,
    'description: "Home screen"',
    'interactive: false, description: "Home screen"',
    "interactive opt-out",
  );
}

/** Close listeners before removing their consumer repository. */
export function removeInteractiveFixture(fixture: TestFixture): Promise<void> {
  return fixture.remove();
}
