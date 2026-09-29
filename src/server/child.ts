import type { RebuildStatus } from "@mokly/viewer/runtime";

import type { ComponentRuntime } from "../build/component_runtime.js";
import type { ResolvedConfig } from "../config/types.js";
import { bindTimings, timeSync } from "../diagnostics/timings.js";

import { configuredServedReview } from "./configured_review.js";
import {
  parseRuntimeMessage,
  requestComponentRuntime,
  type RuntimeMessage,
} from "./controls/runtime_ipc.js";
import { startCatalogueServer } from "./http.js";
import { ServedReviewRepository } from "./review_repository.js";
import {
  parseCatalogueCompleteMessage,
  parseChildUpdateMessage,
  parseRebuildStatusMessage,
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
  interactivePort?: number,
  interactiveOrigin?: string,
): Promise<void> {
  const retained =
    retainedRuntime && manifest?.schemaVersion === "live-index-1"
      ? await receiveWatchedState()
      : undefined;
  const initial = retained?.runtime;
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
    onPreviewResources: (observation) =>
      process.send?.({ type: "preview-resources", ...observation }),
    ...(manifest ? { manifest } : {}),
    ...(interactiveOrigin ? { interactiveOrigin } : {}),
    ...(interactivePort !== undefined ? { interactivePort } : {}),
    ...(initial && manifest
      ? { componentRuntime: { ...initial.runtime, config, manifest } }
      : {}),
    ...(retained ? { rebuildStatus: retained.rebuildStatus } : {}),
    port,
    review: configuredServedReview(config, base, repository),
    strictPort,
    updateVersion,
  });
  const shutdown = waitForChildShutdown(server, config, repository, manifest);
  process.send?.({
    ...(server.interactivePort !== undefined
      ? { interactivePort: server.interactivePort }
      : {}),
    port: server.port,
    type: "ready",
    version: updateVersion,
  });
  if (!process.send) {
    process.stdout.write(`Mokly listening at ${server.url}\n`);
    if (server.interactiveOrigin)
      process.stdout.write(`Mokly Live at ${server.interactiveOrigin}\n`);
  }
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
          server.publishUpdate({
            ...(runtime.changesStatus
              ? { changesStatus: runtime.changesStatus }
              : {}),
            version: runtime.version,
          });
        }
      }
      if (isMessage(message, "rebuild-status")) {
        const rebuild = parseRebuildStatusMessage(message);
        if (!rebuild) reportInvalidRebuildStatus();
        else if (server.replaceRebuildStatus?.(rebuild.status) === "conflict")
          reportInvalidRebuildStatus();
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

interface WatchedStateTransfer {
  rebuildStatus: RebuildStatus;
  runtime: RuntimeMessage;
}

/** Require both validated retained commands inside the startup transfer window. */
export function receiveWatchedState(
  timeoutMilliseconds = 10_000,
): Promise<WatchedStateTransfer> {
  return new Promise((resolve, reject) => {
    let runtime: RuntimeMessage | undefined;
    let rebuildStatus: RebuildStatus | undefined;
    const cleanup = (): void => {
      clearTimeout(timer);
      process.off("message", receive);
      process.off("disconnect", disconnected);
    };
    const finish = (): void => {
      if (!runtime || !rebuildStatus) return;
      cleanup();
      resolve({ rebuildStatus, runtime });
    };
    const receive = (value: unknown): void => {
      if (isMessage(value, "rebuild-status")) {
        const parsed = parseRebuildStatusMessage(value);
        if (!parsed) {
          cleanup();
          reject(new Error("Invalid rebuild status during startup transfer"));
          return;
        }
        rebuildStatus = parsed.status;
      }
      runtime ??= parseRuntimeMessage(value);
      finish();
    };
    const disconnected = (): void => {
      cleanup();
      reject(new Error("Parent disconnected during watched state transfer"));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Watched state transfer timed out"));
    }, timeoutMilliseconds);
    process.on("message", receive);
    process.once("disconnect", disconnected);
    requestComponentRuntime();
  });
}

function reportInvalidRebuildStatus(): void {
  const message = "Ignored an invalid rebuild-status IPC command.";
  if (process.send) process.send({ type: "diagnostic", message });
  else process.stderr.write(`${message}\n`);
}

function isMessage(value: unknown, type: string): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === type
  );
}
