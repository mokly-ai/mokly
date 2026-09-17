import type { ResolvedRegistryEntry } from "../authoring/types.js";

/** One actionable catalogue validation failure. */
export interface RegistryViolation {
  code: string;
  id?: string;
  message: string;
  sourceRelativePath: string;
}

/** A prepared and cross-reference-validated registry. */
export interface PreparedRegistry {
  entries: readonly ResolvedRegistryEntry[];
  byId: ReadonlyMap<string, ResolvedRegistryEntry>;
}
