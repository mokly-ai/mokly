/** Last-good runtime transfer over the watched child's private IPC channel. */
import type { ComponentRuntime } from "../../build/component_runtime.js";
import {
  receiveGeneratedFile,
  transferGeneratedFile,
  type GeneratedFile,
  type TransferredGeneratedFile,
} from "../../build/generated_file.js";
import { isOutputSnapshot } from "../../build/output_snapshot.js";
import type { ResolvedConfig } from "../../config/types.js";
import { isAuthoredClosure } from "../served_closure.js";

/** Accepted configuration and manifest transferred before watched readiness. */
export interface RuntimeStartupMessage {
  /** Last checked list under this configuration, kept across a child restart. */
  assetClosure?: readonly string[];
  config: ResolvedConfig;
  manifest: ComponentRuntime["manifest"];
  type: "component-runtime-startup";
}

/** Heavy retained fields not already supplied in the startup message. */
export type TransferredComponentRuntime = Pick<
  ComponentRuntime,
  | "outputSnapshot"
  | "bundle"
  | "generation"
  | "warningGeneration"
  | "outputs"
  | "stylesheetRoutes"
  | "styleOutputs"
  | "deliveredStyleSources"
>;

export interface RuntimeMessage {
  type: "component-runtime";
  runtime: Omit<TransferredComponentRuntime, "outputs" | "styleOutputs"> & {
    outputs: readonly (readonly [string, TransferredGeneratedFile])[];
    styleOutputs: readonly (readonly [string, TransferredGeneratedFile])[];
  };
  /** Reserved update version published only after the runtime is attached. */
  version?: number;
}

/** Decoded accepted runtime, ready for rendering or binary-safe serving. */
export interface ReceivedRuntimeMessage {
  type: "component-runtime";
  runtime: TransferredComponentRuntime;
  version?: number;
}

/** Strip startup data from a retained-runtime IPC response. */
export function componentRuntimeMessage(
  runtime: ComponentRuntime,
  version?: number,
): RuntimeMessage {
  return {
    runtime: {
      outputSnapshot: Object.freeze({
        schemaVersion: 1,
        routes: Object.freeze([...runtime.outputSnapshot.routes]),
      }),
      bundle: runtime.bundle,
      generation: runtime.generation,
      warningGeneration: runtime.warningGeneration,
      outputs: runtime.outputs.map(
        ([route, content]) => [route, transferGeneratedFile(content)] as const,
      ),
      stylesheetRoutes: runtime.stylesheetRoutes,
      styleOutputs: runtime.styleOutputs.map(
        ([route, content]) => [route, transferGeneratedFile(content)] as const,
      ),
      deliveredStyleSources: runtime.deliveredStyleSources,
    },
    type: "component-runtime",
    ...(version === undefined ? {} : { version }),
  };
}

/** Ask the watched parent for its retained graph after server readiness. */
export function requestComponentRuntime(): void {
  process.send?.({ type: "component-runtime-request" });
}

/** Live indexes need their small rendering graph attached before announcing readiness. */
export function receiveRequestedRuntime(): Promise<ReceivedRuntimeMessage> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      process.off("message", receive);
      process.off("disconnect", disconnected);
    };
    const receive = (value: unknown) => {
      const message = parseRuntimeMessage(value);
      if (message) {
        cleanup();
        resolve(message);
      }
    };
    const disconnected = () => {
      cleanup();
      reject(new Error("Parent disconnected during runtime transfer"));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Consumer runtime transfer timed out"));
    }, 10_000);
    process.on("message", receive);
    process.once("disconnect", disconnected);
    requestComponentRuntime();
  });
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
    !Array.isArray(config.roots) ||
    !config.roots.every(
      (root) =>
        root &&
        typeof root.dir === "string" &&
        Array.isArray(root.files) &&
        root.files.every((glob: unknown) => typeof glob === "string") &&
        Array.isArray(root.transparent),
    ) ||
    (config.entryModules !== undefined &&
      (!Array.isArray(config.entryModules) ||
        !config.entryModules.every((module) => typeof module === "string"))) ||
    typeof config.mockupsDir !== "string" ||
    typeof config.repoRoot !== "string" ||
    typeof config.generatedDir !== "string" ||
    !manifest ||
    !Array.isArray(manifest.entries) ||
    (manifest.schemaVersion !== 9 &&
      manifest.schemaVersion !== "live-index-2") ||
    !Array.isArray(manifest.sourceFiles)
  )
    return;
  const assetClosure = "assetClosure" in value ? value.assetClosure : undefined;
  return {
    ...(isAuthoredClosure(assetClosure) ? { assetClosure } : {}),
    config,
    manifest,
    type: "component-runtime-startup",
  };
}

export function parseRuntimeMessage(
  value: unknown,
): ReceivedRuntimeMessage | undefined {
  if (
    !value ||
    typeof value !== "object" ||
    !("type" in value) ||
    value.type !== "component-runtime" ||
    !("runtime" in value)
  )
    return;
  const runtime = value.runtime as RuntimeMessage["runtime"] | undefined;
  const version = "version" in value ? value.version : undefined;
  if (
    !runtime ||
    !isOutputSnapshot(runtime.outputSnapshot) ||
    typeof runtime.generation !== "string" ||
    typeof runtime.warningGeneration !== "string" ||
    !/^[a-f0-9]{32}$/.test(runtime.warningGeneration) ||
    typeof runtime.bundle?.code !== "string" ||
    !Array.isArray(runtime.outputs) ||
    !Array.isArray(runtime.stylesheetRoutes) ||
    !Array.isArray(runtime.styleOutputs) ||
    !Array.isArray(runtime.deliveredStyleSources) ||
    !runtime.deliveredStyleSources.every(
      (source) => typeof source === "string",
    ) ||
    (version !== undefined &&
      (!Number.isSafeInteger(version) || (version as number) <= 0))
  )
    return;
  const outputs = receiveOutputPairs(runtime.outputs);
  const styleOutputs = receiveOutputPairs(runtime.styleOutputs);
  if (!outputs || !styleOutputs) return;
  if (
    !runtime.stylesheetRoutes.every(
      (item) =>
        Array.isArray(item) &&
        item.length === 2 &&
        typeof item[0] === "string" &&
        typeof item[1] === "string",
    )
  )
    return;
  return {
    type: "component-runtime",
    runtime: {
      outputSnapshot: Object.freeze({
        schemaVersion: 1,
        routes: Object.freeze([...runtime.outputSnapshot.routes]),
      }),
      bundle: runtime.bundle,
      generation: runtime.generation,
      warningGeneration: runtime.warningGeneration,
      outputs,
      stylesheetRoutes: runtime.stylesheetRoutes,
      styleOutputs,
      deliveredStyleSources: runtime.deliveredStyleSources,
    },
    ...(version === undefined ? {} : { version: version as number }),
  };
}

function receiveOutputPairs(
  pairs: readonly (readonly [string, TransferredGeneratedFile])[],
): Array<readonly [string, GeneratedFile]> | undefined {
  const outputs: Array<readonly [string, GeneratedFile]> = [];
  for (const item of pairs) {
    if (
      !Array.isArray(item) ||
      item.length !== 2 ||
      typeof item[0] !== "string"
    )
      return;
    const content = receiveGeneratedFile(item[1]);
    if (content === undefined) return;
    outputs.push([item[0], content]);
  }
  return outputs;
}
