import type { ComponentRuntime } from "../build/component_runtime.js";
import type { BuildWarning } from "../build/warnings.js";
import type { ResolvedConfig } from "../config/types.js";
import { bindTimings, timeSync } from "../diagnostics/timings.js";

import { configuredServedReview } from "./configured_review.js";
import {
  parseRuntimeMessage,
  requestComponentRuntime,
  receiveRequestedRuntime,
} from "./controls/runtime_ipc.js";
import { startCatalogueServer } from "./http.js";
import { ServedReviewRepository } from "./review_repository.js";
import {
  parseCatalogueCompleteMessage,
  parseChildUpdateMessage,
} from "./update_messages.js";

/** Run the hidden deterministic server child until its parent shuts it down. */
export async function runServerChild(
  config: ResolvedConfig,
  port: number,
  base: string,
  updateVersion: number,
  strictPort: boolean,
  retainedRuntime: boolean,
  manifest?: ComponentRuntime["manifest"],
  onWarning?: (warning: BuildWarning) => void,
): Promise<void> {
  const initial =
    retainedRuntime && manifest?.schemaVersion === "live-index-1"
      ? await receiveRequestedRuntime()
      : undefined;
  if (initial?.version) updateVersion = initial.version;
  const repository = new ServedReviewRepository(config, updateVersion);
  const server = await startCatalogueServer(config, {
    base,
    changesStatus: "pending",
    onForeground: (active) => process.send?.({ type: "foreground", active }),
    onDiagnostic: (error) => {
      const message = typeof error === "string" ? error : String(error);
      if (process.send) process.send({ type: "diagnostic", message });
      else process.stderr.write(`${message}\n`);
    },
    ...(onWarning ? { onBuildWarning: onWarning } : {}),
    onPreviewResources: (observation) =>
      process.send?.({ type: "preview-resources", ...observation }),
    ...(manifest ? { manifest } : {}),
    ...(initial && manifest
      ? { componentRuntime: { ...initial.runtime, config, manifest } }
      : {}),
    port,
    review: configuredServedReview(config, base, repository),
    strictPort,
    updateVersion,
  });
  const shutdown = waitForChildShutdown(server, config, repository, manifest);
  process.send?.({ port: server.port, type: "ready", version: updateVersion });
  if (!process.send) process.stdout.write(`Mokly listening at ${server.url}\n`);
  if (retainedRuntime && !initial) requestComponentRuntime();
  try {
    await shutdown;
  } finally {
    if (process.connected) process.disconnect?.();
  }
}

function waitForChildShutdown(
  server: Awaited<ReturnType<typeof startCatalogueServer>>,
  config: ResolvedConfig,
  repository: ServedReviewRepository,
  manifest?: ComponentRuntime["manifest"],
): Promise<void> {
  return new Promise((resolve, reject) => {
    let closing = false;
    const cleanup = (): void => {
      process.off("disconnect", onDisconnect);
      process.off("message", receive);
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
    };
    const close = async (): Promise<void> => {
      if (closing) return;
      closing = true;
      try {
        await server.close();
        cleanup();
        resolve();
      } catch (error) {
        cleanup();
        reject(error);
      }
    };
    const onMessage = (message: unknown): void => {
      const complete = parseCatalogueCompleteMessage(message);
      if (
        complete &&
        server.completeCatalogue?.(complete.manifest, complete.generation)
      ) {
        repository.accept(undefined, complete.version);
        server.publishUpdate({ kind: "evidence", version: complete.version });
      }
      const runtime = parseRuntimeMessage(message);
      if (runtime && manifest) {
        timeSync("runtime.attach", () =>
          server.replaceComponentRuntime({
            ...runtime.runtime,
            config,
            manifest,
          }),
        );
        if (runtime.version !== undefined) {
          repository.accept(undefined, runtime.version);
          server.publishUpdate({ version: runtime.version });
        }
      }
      const update = parseChildUpdateMessage(message);
      if (update) {
        repository.accept(update.baselineCommit, update.version);
        server.publishUpdate({
          ...(update.kind ? { kind: update.kind } : {}),
          changesStatus:
            update.changesStatus ??
            (update.changedRoutes === null ? "pending" : "ready"),
          changedRoutes: update.changedRoutes,
          componentChanges: update.componentChanges,
          version: update.version,
        });
      }
      if (isMessage(message, "shutdown")) void close();
    };
    const onDisconnect = (): void => void close();
    const onSignal = (): void => void close();
    process.once("disconnect", onDisconnect);
    const receive = bindTimings(onMessage);
    process.on("message", receive);
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
  });
}

function isMessage(value: unknown, type: string): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === type
  );
}
