import type { StaticDelivery, ReviewArtifactContent } from "@mokly/viewer/data";

import type { LegacyExportOwnership } from "./ownership.js";

/** Immutable route information available before an adapter finishes staging. */
export interface ExportRoutes {
  readonly outDir: string;
  readonly comparisonUrl: string | null;
  readonly idRoutes: StaticDelivery["idRoutes"];
}

/** Final identity and paths produced by one completed static export. */
export interface ExportResult extends ExportRoutes {
  readonly deploymentId: string;
}

/** Internal staging adapter for repository delivery and upload metadata. */
export interface ExportAdapter {
  /** Optional stricter config-relative root, pinned for this operation. */
  outputRoot?: string;
  legacyOwnership?: LegacyExportOwnership;
  transform(
    files: Map<string, ReviewArtifactContent>,
    result: ExportRoutes,
  ):
    | void
    | ReadonlyMap<string, string>
    | Promise<void | ReadonlyMap<string, string>>;
}

/** One explicit export request, with optional cancellation and internal adapter. */
export interface ExportOptions {
  outDir: string;
  base?: string;
  /** Omit baseline reads and comparison artifacts; publish uses this capability. */
  noChanges?: boolean;
  /** Consume finalized bytes before installation, while the output is reserved. */
  capture?: (
    files: ReadonlyMap<string, ReviewArtifactContent>,
  ) => Promise<void>;
  signal?: AbortSignal;
  adapter?: ExportAdapter;
}
