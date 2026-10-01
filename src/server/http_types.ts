import type { ManifestV7 } from "@mokly/viewer/data";
import type { RebuildStatus } from "@mokly/viewer/runtime";

import type { ComponentRuntime } from "../build/component_runtime.js";
import type { InteractiveServerFactory } from "../interactive/server.js";

import type { CatalogueSnapshot } from "./catalogue_snapshot.js";
import type {
  ComponentChangeSource,
  ComponentChangeSnapshot,
} from "./component_changes.js";
import type { ServedReview } from "./configured_review.js";
import type { PreviewObservation } from "./demand/observation.js";
import type { RebuildStatusAcceptance } from "./rebuild_status_state.js";
import type { CatalogueUpdate, ChangesStatus } from "./update_messages.js";

/** Options for one deterministic server child. */
export interface ServerOptions {
  changesStatus?: ChangesStatus;
  /** Include live Changes states by default; static captures opt out. */
  liveChanges?: boolean;
  onForeground?: (active: boolean) => void;
  onDiagnostic?: (error: unknown) => void;
  onPreviewResources?: (observation: PreviewObservation) => void;
  base: string;
  /** Reuse a validated startup or publication generation without rereading metadata. */
  snapshot?: CatalogueSnapshot;
  componentRuntime?: ComponentRuntime;
  changedIds?: readonly string[];
  /** Precomputed component and screen evidence for the immutable generation. */
  componentChanges?: ComponentChangeSnapshot;
  componentChangeSource?: ComponentChangeSource;
  /** Parent-validated manifest supplied to a watched server child. */
  manifest?: ComponentRuntime["manifest"];
  /** Browser-facing Live origin when a forwarding layer changes authority. */
  interactiveOrigin?: string;
  /** Requested starting port for the isolated Live listener. */
  interactivePort?: number;
  /** Injectable construction boundary for the isolated Live listener. */
  interactiveServerFactory?: InteractiveServerFactory;
  port: number;
  /** Enables on-demand comparison JSON and isolated snapshots. */
  review?: ServedReview;
  /** Initial private snapshot supplied only to a watched HTTP child. */
  rebuildStatus?: RebuildStatus;
  strictPort?: boolean;
  updateVersion?: number;
}

/** Running server lifecycle and update-stream boundary. */
export interface RunningServer {
  completeCatalogue?(manifest: ManifestV7, generation: string): boolean;
  close(): Promise<void>;
  interactiveOrigin?: string;
  interactivePort?: number;
  publishUpdate(update?: CatalogueUpdate): void;
  replaceRebuildStatus?(status: RebuildStatus): RebuildStatusAcceptance;
  replaceComponentRuntime(runtime: ComponentRuntime): void;
  port: number;
  url: string;
}
