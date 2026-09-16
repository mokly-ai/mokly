/** Strict validation of one-shot Browse recovery from untrusted session storage. */
import type { BrowseRecoveryState } from "./browse_state.js";

export function parseBrowseRecoveryState(
  value: unknown,
): BrowseRecoveryState | undefined {
  if (!record(value)) return undefined;
  const changedOnly = value["changedOnly"];
  const changesStatus = value["changesStatus"];
  const colorScheme = value["colorScheme"];
  const storedFilterBaselineClosedCollectionIds =
    value["filterBaselineClosedCollectionIds"];
  const filterBaselineClosedCollectionIds =
    storedFilterBaselineClosedCollectionIds === undefined
      ? null
      : storedFilterBaselineClosedCollectionIds;
  const query = value["query"];
  const viewport = value["viewport"];
  if (
    typeof changedOnly !== "boolean" ||
    (changesStatus !== undefined &&
      changesStatus !== "preparing" &&
      changesStatus !== "pending" &&
      changesStatus !== "ready" &&
      changesStatus !== "unavailable") ||
    !stringArray(value["closedCollectionIds"]) ||
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
    filterBaselineClosedCollectionIds !== null &&
    (!stringArray(filterBaselineClosedCollectionIds) ||
      (!changedOnly && query.trim() === ""))
  )
    return undefined;
  return {
    changedOnly,
    ...(changesStatus ? { changesStatus } : {}),
    closedCollectionIds: [...new Set(value["closedCollectionIds"])],
    colorScheme,
    detailsOpen: value["detailsOpen"],
    drawerOpen: value["drawerOpen"],
    filterBaselineClosedCollectionIds:
      filterBaselineClosedCollectionIds === null
        ? null
        : [...new Set(filterBaselineClosedCollectionIds)],
    navScroll: value["navScroll"],
    query,
    regionScrolls: { ...value["regionScrolls"] },
    viewport,
  };
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
