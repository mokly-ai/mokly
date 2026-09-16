import type { ManifestV5 } from "@mokly/viewer/data";

import type { ComponentRuntime } from "../build/component_runtime.js";

import type { CatalogueSnapshot } from "./catalogue_snapshot.js";
import type {
  ComponentChangeSource,
  ComponentChangeSnapshot,
} from "./component_changes.js";
import type { PreviewObservation } from "./demand/observation.js";
import type { ServedReview } from "./review_routes.js";
import type { CatalogueUpdate, ChangesStatus } from "./update_messages.js";

/** Options for one deterministic server child. */
export interface ServerOptions {
  changesStatus?: ChangesStatus;
  /** Include live Changes states by default; static captures opt out. */
  liveChanges?: boolean;
  onForeground?: (active: boolean) => void;
  onPreviewResources?: (observation: PreviewObservation) => void;
  base: string;
  /** Reuse a validated startup or publication generation without rereading metadata. */
  snapshot?: CatalogueSnapshot;
  componentRuntime?: ComponentRuntime;
  changedRoutes?: readonly string[];
  /** Precomputed component and screen evidence for the immutable generation. */
  componentChanges?: ComponentChangeSnapshot;
  componentChangeSource?: ComponentChangeSource;
  /** Parent-validated manifest supplied to a watched server child. */
  manifest?: ComponentRuntime["manifest"];
  port: number;
  /** Enables on-demand comparison JSON and isolated snapshots. */
  review?: ServedReview;
  strictPort?: boolean;
  updateVersion?: number;
}

/** Running server lifecycle and update-stream boundary. */
export interface RunningServer {
  completeCatalogue?(manifest: ManifestV5, generation: string): boolean;
  close(): Promise<void>;
  publishUpdate(update?: CatalogueUpdate): void;
  replaceComponentRuntime(runtime: ComponentRuntime): void;
  port: number;
  url: string;
}
