/** Last-good runtime transfer over the watched child's private IPC channel. */
import { isCatalogueId } from "@mokly/viewer/data";

import type { ComponentRuntime } from "../../build/component_runtime.js";
import { validatePublicExclude } from "../../config/public_exclusions.js";
import type { ResolvedConfig } from "../../config/types.js";
import { MoklyError } from "../../errors.js";

/** Accepted configuration and manifest transferred before watched readiness. */
export interface RuntimeStartupMessage {
  config: ResolvedConfig;
  manifest: ComponentRuntime["manifest"];
  type: "component-runtime-startup";
}

/** Heavy retained fields not already supplied in the startup message. */
export type TransferredComponentRuntime = Pick<
  ComponentRuntime,
  "bundle" | "generation" | "interactiveEntries" | "outputs"
>;

export interface RuntimeMessage {
  changesStatus?: "pending" | "preparing";
  type: "component-runtime";
  runtime: TransferredComponentRuntime;
  /** Reserved update version published only after the runtime is attached. */
  version?: number;
}

/** Strip startup data from a retained-runtime IPC response. */
export function componentRuntimeMessage(
  runtime: ComponentRuntime,
  version?: number,
  changesStatus?: "pending" | "preparing",
): RuntimeMessage {
  return {
    runtime: {
      bundle: runtime.bundle,
      generation: runtime.generation,
      interactiveEntries: runtime.interactiveEntries,
      outputs: runtime.outputs,
    },
    type: "component-runtime",
    ...(changesStatus ? { changesStatus } : {}),
    ...(version === undefined ? {} : { version }),
  };
}

/** Ask the watched parent for its retained graph during startup transfer. */
export function requestComponentRuntime(): void {
  process.send?.({ type: "component-runtime-request" });
}

/** Receive parent-validated metadata before the child checks its source inventory. */
export function receiveComponentRuntimeStartup(): Promise<RuntimeStartupMessage> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      clearTimeout(timer);
      process.off("message", onMessage);
      process.off("disconnect", onDisconnect);
    };
    const onDisconnect = (): void => {
      cleanup();
      reject(new Error("Parent disconnected before startup transfer"));
    };
    const onMessage = (value: unknown): void => {
      const message = parseRuntimeStartupMessage(value);
      if (!message) return;
      cleanup();
      resolve(message);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Consumer startup transfer timed out"));
    }, 10_000);
    process.on("message", onMessage);
    process.once("disconnect", onDisconnect);
    process.send?.({ type: "component-runtime-startup-request" });
  });
}

function parseRuntimeStartupMessage(
  value: unknown,
): RuntimeStartupMessage | undefined {
  if (
    !value ||
    typeof value !== "object" ||
    !("type" in value) ||
    value.type !== "component-runtime-startup" ||
    !("config" in value) ||
    !("manifest" in value)
  )
    return;
  const config = value.config as ResolvedConfig | undefined;
  const manifest = value.manifest as ComponentRuntime["manifest"] | undefined;
  if (
    !config ||
    typeof config.configPath !== "string" ||
    !Array.isArray(config.entryGlobs) ||
    !config.entryGlobs.every((glob) => typeof glob === "string") ||
    (config.entryModules !== undefined &&
      (!Array.isArray(config.entryModules) ||
        !config.entryModules.every((module) => typeof module === "string"))) ||
    typeof config.mockupsDir !== "string" ||
    typeof config.repoRoot !== "string" ||
    !Array.isArray(config.publicExclude) ||
    !manifest ||
    !Array.isArray(manifest.entries) ||
    (manifest.schemaVersion !== 5 &&
      manifest.schemaVersion !== "live-index-1") ||
    !Array.isArray(manifest.sourceFiles)
  )
    return;
  try {
    const publicExclude = validatePublicExclude(config.publicExclude);
    return {
      config: { ...config, publicExclude },
      manifest,
      type: "component-runtime-startup",
    };
  } catch (error) {
    if (error instanceof MoklyError) return;
    throw error;
  }
}

export function parseRuntimeMessage(
  value: unknown,
): RuntimeMessage | undefined {
  if (
    !value ||
    typeof value !== "object" ||
    !("type" in value) ||
    value.type !== "component-runtime" ||
    !("runtime" in value)
  )
    return;
  const runtime = value.runtime as TransferredComponentRuntime | undefined;
  const version = "version" in value ? value.version : undefined;
  const changesStatus =
    "changesStatus" in value ? value.changesStatus : undefined;
  if (
    !runtime ||
    typeof runtime.generation !== "string" ||
    typeof runtime.bundle?.code !== "string" ||
    !interactiveEntries(runtime.interactiveEntries) ||
    !Array.isArray(runtime.outputs) ||
    (changesStatus !== undefined &&
      changesStatus !== "pending" &&
      changesStatus !== "preparing") ||
    (version !== undefined &&
      (!Number.isSafeInteger(version) || (version as number) <= 0))
  )
    return;
  return {
    type: "component-runtime",
    ...(changesStatus ? { changesStatus } : {}),
    runtime: {
      bundle: runtime.bundle,
      generation: runtime.generation,
      interactiveEntries: runtime.interactiveEntries,
      outputs: runtime.outputs,
    },
    ...(version === undefined ? {} : { version: version as number }),
  };
}

function interactiveEntries(
  value: unknown,
): value is Readonly<Record<string, boolean>> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.entries(value).every(
      ([id, interactive]) =>
        isCatalogueId(id) && typeof interactive === "boolean",
    )
  );
}
