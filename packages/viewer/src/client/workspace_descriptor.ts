/** Validation for route-scoped workspace data embedded in shell documents. */

import type { WorkspaceData } from "../shell/workspace_data.js";

/** Identity fields that bind workspace evidence to one accepted shell source. */
export interface WorkspaceDescriptorSource {
  base: string;
  previewGeneration?: string;
}

/** Validate embedded workspace evidence before React adopts it. */
export function readViewerWorkspace(
  value: unknown,
  source?: WorkspaceDescriptorSource,
): WorkspaceData {
  if (!record(value) || !record(value["entry"]))
    throw new Error("Invalid viewer workspace evidence.");
  const entry = value["entry"];
  const arrays = [
    "components",
    "views",
    "variants",
    "usedBy",
    "affected",
    "relatedComponents",
    "inputChanges",
  ];
  if (
    (entry["kind"] !== "screen" && entry["kind"] !== "component") ||
    typeof entry["id"] !== "string" ||
    typeof entry["route"] !== "string" ||
    typeof value["base"] !== "string" ||
    typeof value["comparisons"] !== "boolean" ||
    typeof value["comparisonEligible"] !== "boolean" ||
    typeof value["removed"] !== "boolean" ||
    arrays.some((key) => !Array.isArray(value[key])) ||
    "renderCapability" in value ||
    "token" in value ||
    (source !== undefined &&
      (value["base"] !== source.base ||
        value["previewGeneration"] !== source.previewGeneration))
  )
    throw new Error("Invalid viewer workspace evidence.");
  return value as unknown as WorkspaceData;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
