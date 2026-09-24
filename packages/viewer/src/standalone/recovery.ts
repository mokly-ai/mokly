/** Strict validation for one-shot watched-shell recovery state. */

import type { LiveChangesStatus } from "../shell/metadata.js";

/** Stored shell state consumed once after an automatic watched reload. */
export interface BrowseRecoveryState {
  changesStatus?: LiveChangesStatus;
  changedOnly: boolean;
  closedFolderKeys: readonly string[];
  colorScheme: "dark" | "light";
  detailsOpen: boolean;
  drawerOpen: boolean;
  filterBaselineClosedFolderKeys: readonly string[] | null;
  navScroll: number;
  query: string;
  regionScrolls: Readonly<Record<string, number>>;
  viewport: "both" | "desktop" | "mobile";
}

/** Reject malformed session-storage values before restoring shell state. */
export function parseBrowseRecoveryState(
  value: unknown,
): BrowseRecoveryState | undefined {
  if (!record(value)) return undefined;
  const changedOnly = value["changedOnly"];
  const changesStatus = value["changesStatus"];
  const colorScheme = value["colorScheme"];
  const storedBaseline = value["filterBaselineClosedFolderKeys"];
  const baseline = storedBaseline === undefined ? null : storedBaseline;
  const query = value["query"];
  const viewport = value["viewport"];
  if (
    typeof changedOnly !== "boolean" ||
    !validChangesStatus(changesStatus) ||
    !stringArray(value["closedFolderKeys"]) ||
    (colorScheme !== "dark" && colorScheme !== "light") ||
    typeof value["detailsOpen"] !== "boolean" ||
    typeof value["drawerOpen"] !== "boolean" ||
    !nonNegativeNumber(value["navScroll"]) ||
    typeof query !== "string" ||
    !scrollRecord(value["regionScrolls"]) ||
    (viewport !== "both" && viewport !== "desktop" && viewport !== "mobile")
  )
    return undefined;
  if (
    baseline !== null &&
    (!stringArray(baseline) || (!changedOnly && query.trim() === ""))
  )
    return undefined;
  return {
    changedOnly,
    ...(changesStatus ? { changesStatus } : {}),
    closedFolderKeys: [...new Set(value["closedFolderKeys"])],
    colorScheme,
    detailsOpen: value["detailsOpen"],
    drawerOpen: value["drawerOpen"],
    filterBaselineClosedFolderKeys:
      baseline === null ? null : [...new Set(baseline)],
    navScroll: value["navScroll"],
    query,
    regionScrolls: { ...value["regionScrolls"] },
    viewport,
  };
}

function validChangesStatus(
  value: unknown,
): value is LiveChangesStatus | undefined {
  return (
    value === undefined ||
    value === "preparing" ||
    value === "pending" ||
    value === "ready" ||
    value === "unavailable"
  );
}

function nonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scrollRecord(
  value: unknown,
): value is Readonly<Record<string, number>> {
  return (
    record(value) &&
    Object.values(value).every((entry) => nonNegativeNumber(entry))
  );
}

function stringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.length > 0)
  );
}
