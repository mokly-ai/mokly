/** Saved component variant selection shared by routing and workspace rendering. */

import type { WorkspaceData, WorkspaceVariant } from "./workspace_data.js";

/** Result of resolving the saved variant query for one workspace. */
export interface WorkspaceVariantSelection {
  variant?: WorkspaceVariant;
  error?: string;
  comparisonEligible: boolean;
}

/** Resolve one saved variant without accepting duplicate or unknown values. */
export function selectedVariant(
  data: WorkspaceData,
  search: string,
): WorkspaceVariantSelection {
  if (data.entry.kind !== "component")
    return { comparisonEligible: data.comparisonEligible };
  const ids = new URLSearchParams(search).getAll("variant");
  if (ids.length > 1)
    return {
      error: "Choose one saved variant.",
      comparisonEligible: false,
    };
  const variant = ids.length
    ? data.variants.find((item) => item.value.id === ids[0])
    : data.variants[0];
  return variant
    ? { variant, comparisonEligible: variant.comparisonEligible }
    : {
        error: "This saved variant is unavailable. Choose another variant.",
        comparisonEligible: false,
      };
}

/** Resolve an already parsed route variant through the same validation path. */
export function selectedVariantId(
  data: WorkspaceData,
  requested: string | readonly string[] | undefined,
): WorkspaceVariantSelection {
  const query = new URLSearchParams();
  const values = typeof requested === "string" ? [requested] : requested;
  for (const value of values ?? []) query.append("variant", value);
  return selectedVariant(data, query.toString());
}
