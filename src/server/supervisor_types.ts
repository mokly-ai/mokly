/** Contracts for watched Serve child-process supervision. */

import type { ManifestV7 } from "@mokly/viewer/data";

import type { ComponentRuntime } from "../build/component_runtime.js";

import type { ComponentChangeSnapshot } from "./component_changes.js";
import type { PreviewObservation } from "./demand/observation.js";
import type { RebuildStatusPublisher } from "./rebuild_status.js";
import type { ChangesStatus, CatalogueUpdateKind } from "./update_messages.js";

/** Restartable child interface used by watched Serve. */
export interface ProcessSupervisor extends RebuildStatusPublisher {
  interactivePort?(): number | undefined;
  completeCatalogue?(manifest: ManifestV7, generation: string): void;
  onForeground?(callback: (active: boolean) => void): void;
  onDiagnostic?(callback: (message: string) => void): void;
  onPreviewResources?(
    callback: (observation: PreviewObservation) => void,
  ): void;
  /** Stage the next child's graph, or update a child whose catalogue is unchanged. */
  replaceComponentRuntime(
    runtime: ComponentRuntime,
    delivery: "stage" | "live",
    version?: number,
    changesStatus?: "pending" | "preparing",
  ): void;
  close(): Promise<void>;
  notifyUpdate(
    changedIds: readonly string[] | undefined,
    componentChanges?: ComponentChangeSnapshot,
    changesStatus?: ChangesStatus,
    kind?: CatalogueUpdateKind,
    baselineCommit?: string | null,
  ): void;
  /** Register the watched-runtime handler for a post-readiness child failure. */
  onUnexpectedExit(callback: (error: Error) => void): void;
  reserveUpdateVersion(): number;
  restart(version?: number): Promise<number>;
  start(version?: number): Promise<number>;
}

/** Factory seam for selecting the watched child-process implementation. */
export interface ProcessSupervisorFactory {
  create(
    binPath: string,
    baseArguments: readonly string[],
    requestedPort: number,
    options?: ProcessSupervisorOptions,
  ): ProcessSupervisor;
}

/** Listener options retained across watched child restarts. */
export interface ProcessSupervisorOptions {
  interactiveOrigin?: string;
  interactivePort?: number;
  strictPort?: boolean;
}
