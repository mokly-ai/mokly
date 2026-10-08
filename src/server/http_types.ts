import type { ManifestV9 } from "@mokly/viewer/data";

import type { ComponentRuntime } from "../build/component_runtime.js";
import type { GeneratedFile } from "../build/generated_file.js";

import type { CatalogueSnapshot } from "./catalogue_snapshot.js";
import type {
  ComponentChangeSource,
  ComponentChangeSnapshot,
} from "./component_change_types.js";
import type { ServedReview } from "./configured_review.js";
import type { PreviewObservation } from "./demand/observation.js";
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
  changedEntries?: readonly string[];
  /** Precomputed component and screen evidence for the immutable generation. */
  componentChanges?: ComponentChangeSnapshot;
  componentChangeSource?: ComponentChangeSource;
  /** Parent-validated manifest supplied to a watched server child. */
  manifest?: ComponentRuntime["manifest"];
  /** Last checked closure a restarted watched child serves until its first result. */
  assetClosure?: readonly string[];
  /** Immutable compiled documents supplied by a static capture. */
  generatedOutputs?: ReadonlyMap<string, GeneratedFile>;
  port: number;
  /** Enables on-demand comparison JSON and isolated snapshots. */
  review?: ServedReview;
  strictPort?: boolean;
  updateVersion?: number;
}

/** Running server lifecycle and update-stream boundary. */
export interface RunningServer {
  /** Adopt a complete catalogue and serve a supplied list over its manifest closure. */
  completeCatalogue?(
    manifest: ManifestV9,
    generation: string,
    assetClosure?: readonly string[],
  ): boolean;
  close(): Promise<void>;
  publishUpdate(update?: CatalogueUpdate): void;
  replaceComponentRuntime(runtime: ComponentRuntime): void;
  port: number;
  url: string;
}
