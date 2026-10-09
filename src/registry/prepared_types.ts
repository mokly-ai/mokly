import type { ResolvedRegistryEntry } from "../authoring/types.js";
import type { BuildDiagnostic } from "../build/build_warnings.js";

import type { FolderRecord } from "./folder_records.js";

/** One actionable catalogue validation failure. */
export interface RegistryViolation {
  code: string;
  path?: string;
  message: string;
  sourceRelativePath: string;
}

/** A prepared and cross-reference-validated registry. */
export interface PreparedRegistry {
  folders: readonly FolderRecord[];
  references: ReadonlyMap<string, string>;
  entries: readonly ResolvedRegistryEntry[];
  byPath: ReadonlyMap<string, ResolvedRegistryEntry>;
  diagnostics: readonly BuildDiagnostic[];
}
