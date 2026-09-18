import type {
  ComponentViewRecord,
  CatalogueReadModel,
  ChangesStatus,
} from "@mokly/viewer";
import type { ReviewResult } from "@mokly/viewer/data";
import type { Catalogue } from "@mokly/viewer/server";

import type { ComponentChangeSnapshot } from "../server/component_changes.js";

/** Accepted state only: projection has no filesystem, Git, clock or renderer dependency. */
export interface CatalogueProjectionInput {
  configPath: string;
  catalogue: Catalogue;
  changesStatus: ChangesStatus;
  changedRoutes?: readonly string[] | undefined;
  evidence?: ComponentChangeSnapshot | undefined;
  comparison?: ReviewResult | undefined;
  comparisonUrl: string | null;
  revision: CatalogueReadModel["revision"];
  /** Actual saved on-demand documents override exhaustive render-order records. */
  usage?: ReadonlyMap<string, ComponentViewRecord> | undefined;
}
