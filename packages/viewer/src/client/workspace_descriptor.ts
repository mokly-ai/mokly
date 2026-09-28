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
  return readWorkspace(value, source, false);
}

/** Validate private Serve evidence and bind known eligibility to Live. */
export function readViewerPrivateWorkspace(
  value: unknown,
  source: WorkspaceDescriptorSource,
  interactive: boolean,
): WorkspaceData {
  return readWorkspace(value, source, interactive);
}

function readWorkspace(
  value: unknown,
  source: WorkspaceDescriptorSource | undefined,
  interactive: boolean,
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
    "interactive" in entry ||
    ("interactive" in value &&
      (!interactive ||
        value["removed"] !== false ||
        typeof value["interactive"] !== "boolean")) ||
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
