/** Strict validation for one-shot watched-shell recovery state. */

import {
  decodeDisclosureMap,
  isDisclosureMap,
} from "../shell/disclosure_storage.js";
import type { LiveChangesStatus } from "../shell/metadata.js";

/** Stored shell state consumed once after an automatic watched reload. */
export interface BrowseRecoveryState {
  changesStatus?: LiveChangesStatus;
  changedOnly: boolean;
  disclosures: Readonly<Record<string, boolean>> | null;
  colorScheme: "dark" | "light";
  detailsOpen: boolean;
  drawerOpen: boolean;
  filterBaselineDisclosures: Readonly<Record<string, boolean>> | null;
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
  if (
    "closedFolderKeys" in value ||
    "closedCollectionIds" in value ||
    "filterBaselineClosedFolderKeys" in value
  )
    return undefined;
  const changedOnly = value["changedOnly"];
  const changesStatus = value["changesStatus"];
  const colorScheme = value["colorScheme"];
  const storedBaseline = value["filterBaselineDisclosures"];
  const baseline = storedBaseline === undefined ? null : storedBaseline;
  const query = value["query"];
  const viewport = value["viewport"];
  if (
    typeof changedOnly !== "boolean" ||
    !validChangesStatus(changesStatus) ||
    (value["disclosures"] !== null && !isDisclosureMap(value["disclosures"])) ||
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
    (!isDisclosureMap(baseline) || (!changedOnly && query.trim() === ""))
  )
    return undefined;
  return {
    changedOnly,
    ...(changesStatus ? { changesStatus } : {}),
    disclosures:
      value["disclosures"] === null
        ? null
        : decodeDisclosureMap(value["disclosures"]),
    colorScheme,
    detailsOpen: value["detailsOpen"],
    drawerOpen: value["drawerOpen"],
    filterBaselineDisclosures:
      baseline === null ? null : decodeDisclosureMap(baseline),
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
