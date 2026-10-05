/** Restart supervision retains ownership until each child's cleanup completes. */

import type { ManifestV8 } from "@mokly/viewer/data";
import type { RebuildStatus } from "@mokly/viewer/runtime";

import type { ComponentRuntime } from "../build/component_runtime.js";
import { bindTimings, timeSync } from "../diagnostics/timings.js";
import { MoklyError } from "../errors.js";

import { ManagedChild, type ChildShutdownTimings } from "./child_lifecycle.js";
import { NodeChildFactory, type ChildFactory } from "./child_process.js";
import type { ComponentChangeSnapshot } from "./component_changes.js";
import { componentRuntimeMessage } from "./controls/runtime_ipc.js";
import {
  parsePreviewObservation,
  type PreviewObservation,
} from "./demand/observation.js";
import type {
  ProcessSupervisor,
  ProcessSupervisorFactory,
  ProcessSupervisorOptions,
} from "./supervisor_types.js";
import {
  childUpdateMessage,
  parseChildDiagnosticMessage,
  type ChangesStatus,
  type CatalogueUpdateKind,
} from "./update_messages.js";

/** Node child-process supervisor factory. */
export class NodeProcessSupervisorFactory implements ProcessSupervisorFactory {
  create(
    binPath: string,
    baseArguments: readonly string[],
    requestedPort: number,
    options: ProcessSupervisorOptions = {},
  ): ProcessSupervisor {
    return new ReadyProcessSupervisor(
      new NodeChildFactory(binPath),
      baseArguments,
      requestedPort,
      undefined,
      options,
    );
  }
}

/** Child supervisor that waits for readiness and retains a resolved port. */
export class ReadyProcessSupervisor implements ProcessSupervisor {
  #child: ManagedChild | undefined;
  #unexpectedExit: ((error: Error) => void) | undefined;
  #resolvedPort: number | undefined;
  #resolvedInteractivePort: number | undefined;
  #updateVersion = 0;
  #runtime: ComponentRuntime | undefined;
  #rebuildStatus: RebuildStatus | undefined;
  #foreground: ((active: boolean) => void) | undefined;
  #diagnostic: ((message: string) => void) | undefined;
  #previewResources: ((observation: PreviewObservation) => void) | undefined;

  constructor(
    private readonly factory: ChildFactory,
    private readonly baseArguments: readonly string[],
    private readonly requestedPort: number,
    private readonly shutdownTimings?: ChildShutdownTimings,
    private readonly options: ProcessSupervisorOptions = {},
  ) {}

  interactivePort(): number | undefined {
    return this.#resolvedInteractivePort;
  }

  async start(version?: number): Promise<number> {
    if (this.#child)
      throw new MoklyError("server-failed", "server child is already running");
    const resolvedPort = this.#resolvedPort;
    const startupVersion = version ?? this.reserveUpdateVersion();
    if (startupVersion !== this.#updateVersion)
      throw new MoklyError(
        "server-failed",
        "reserved child update version is no longer current",
      );
    const runtime = this.#runtime;
    const handle = this.factory.spawn([
      ...this.baseArguments,
      ...(this.options.appOrigin
        ? ["--app-origin", this.options.appOrigin]
        : []),
      ...(runtime ? ["--retained-runtime"] : []),
      "--port",
      String(resolvedPort ?? this.requestedPort),
      ...(resolvedPort === undefined ? [] : ["--strict-port"]),
      ...(this.options.strictPort && resolvedPort === undefined
        ? ["--strict-port"]
        : []),
      ...(this.#resolvedInteractivePort !== undefined
        ? ["--interactive-port", String(this.#resolvedInteractivePort)]
        : this.options.interactivePort !== undefined
          ? ["--interactive-port", String(this.options.interactivePort)]
          : []),
      ...(this.options.interactiveOrigin
        ? ["--interactive-origin", this.options.interactiveOrigin]
        : []),
      "--update-version",
      String(startupVersion),
    ]);
    let started = false;
    const child = new ManagedChild(
      handle,
      (error) => {
        if (!started || this.#child !== child) return;
        this.#foreground?.(false);
        if (child.exited) this.#child = undefined;
        else void this.stop(child);
        this.#unexpectedExit?.(error);
      },
      this.shutdownTimings,
    );
    this.#child = child;
    child.onMessage(
      bindTimings((message: unknown) => {
        const diagnostic = parseChildDiagnosticMessage(message);
        if (diagnostic && this.#child === child)
          this.#diagnostic?.(diagnostic.message);
        if (
          message &&
          typeof message === "object" &&
          "type" in message &&
          message.type === "preview-resources" &&
          this.#child === child
        ) {
          const observation = parsePreviewObservation(message);
          if (observation?.generation === this.#runtime?.generation)
            this.#previewResources?.(observation!);
        }
        if (
          message &&
          typeof message === "object" &&
          "type" in message &&
          message.type === "foreground" &&
          "active" in message &&
          typeof message.active === "boolean" &&
          this.#child === child
        )
          this.#foreground?.(message.active);
        if (
          message &&
          typeof message === "object" &&
          "type" in message &&
          message.type === "component-runtime-startup-request" &&
          runtime
        )
          timeSync("child.send-startup", () =>
            child.send({
              type: "component-runtime-startup",
              config: runtime.config,
              manifest: runtime.manifest,
            }),
          );
        if (
          message &&
          typeof message === "object" &&
          "type" in message &&
          message.type === "component-runtime-request" &&
          runtime
        ) {
          const rebuildStatus = this.#rebuildStatus;
          if (rebuildStatus)
            timeSync("child.send-rebuild-status", () =>
              child.send({
                status: rebuildStatus,
                type: "rebuild-status",
              }),
            );
          timeSync("child.send-runtime", () =>
            child.send(componentRuntimeMessage(runtime, startupVersion)),
          );
        }
      }),
    );
    try {
      const readyPort = await child.ready;
      if (child.failure) throw child.failure;
      if (child.stopping || child.exited)
        throw new MoklyError(
          "server-failed",
          "server child stopped during startup",
        );
      this.#resolvedPort = readyPort;
      this.#resolvedInteractivePort = child.interactivePort;
      started = true;
      return readyPort;
    } catch (error) {
      await this.stop(child);
      throw error;
    }
  }

  async restart(version?: number): Promise<number> {
    await this.close();
    return this.start(version);
  }

  replaceComponentRuntime(
    runtime: ComponentRuntime,
    delivery: "stage" | "live",
    version?: number,
    changesStatus?: "pending" | "preparing",
  ): void {
    this.#runtime = runtime;
    if (delivery === "live")
      this.#child?.send(
        componentRuntimeMessage(runtime, version, changesStatus),
      );
  }

  currentUpdateVersion(): number {
    return Math.max(1, this.#updateVersion);
  }

  publishRebuildStatus(status: RebuildStatus): void {
    this.#rebuildStatus = status;
    this.#child?.send({ status, type: "rebuild-status" });
  }

  reserveUpdateVersion(): number {
    if (this.#updateVersion === Number.MAX_SAFE_INTEGER)
      throw new MoklyError("server-failed", "watched update version exhausted");
    this.#updateVersion += 1;
    return this.#updateVersion;
  }

  notifyUpdate(
    changedEntries: readonly string[] | undefined,
    componentChanges?: ComponentChangeSnapshot,
    changesStatus?: ChangesStatus,
    kind?: CatalogueUpdateKind,
    baselineCommit?: string | null,
  ): void {
    const child = this.#child;
    if (!child || child.stopping || child.exited) return;
    const version = this.reserveUpdateVersion();
    child.send(
      childUpdateMessage(
        version,
        changedEntries,
        componentChanges,
        changesStatus,
        kind,
        baselineCommit,
      ),
    );
  }

  completeCatalogue(manifest: ManifestV8, generation: string): void {
    if (
      this.#runtime?.generation !== generation ||
      !this.#child ||
      this.#child.stopping
    )
      return;
    this.#child.send({
      type: "catalogue-complete",
      manifest,
      generation,
      version: this.reserveUpdateVersion(),
    });
  }
  onForeground(callback: (active: boolean) => void): void {
    this.#foreground = callback;
  }
  onDiagnostic(callback: (message: string) => void): void {
    this.#diagnostic = callback;
  }
  onPreviewResources(
    callback: (observation: PreviewObservation) => void,
  ): void {
    this.#previewResources = callback;
  }

  onUnexpectedExit(callback: (error: Error) => void): void {
    this.#unexpectedExit = callback;
  }

  async close(): Promise<void> {
    if (this.#child) await this.stop(this.#child);
  }

  private async stop(child: ManagedChild): Promise<void> {
    await child.close();
    if (this.#child === child) {
      this.#child = undefined;
      this.#foreground?.(false);
    }
  }
}
