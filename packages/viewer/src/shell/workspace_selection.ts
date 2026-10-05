/** Saved component variant selection derived from the routed entry. */

import { isManifestComponentVariant } from "../components/manifest_types.js";

import type { WorkspaceData, WorkspaceVariant } from "./workspace_data.js";

/** Result of resolving the saved variant entry for one workspace. */
export interface WorkspaceVariantSelection {
  variant?: WorkspaceVariant;
  comparisonEligible: boolean;
}

/** Resolve the routed variant, or the parent's first authored variant. */
export function selectedVariant(
  data: WorkspaceData,
): WorkspaceVariantSelection {
  if (data.entry.kind !== "component")
    return { comparisonEligible: data.comparisonEligible };
  const requested =
    data.entry.kind === "component" && isManifestComponentVariant(data.entry)
      ? data.entry.path
      : undefined;
  const variant = requested
    ? data.variants.find((item) => item.value.path === requested)
    : data.variants[0];
  return variant
    ? { variant, comparisonEligible: variant.comparisonEligible }
    : { comparisonEligible: false };
}
