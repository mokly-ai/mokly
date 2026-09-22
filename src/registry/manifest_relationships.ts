import { analyzeHierarchy, type HierarchyEntry } from "@mokly/viewer/data";

import { isScreenVariantRoute } from "../authoring/variants.js";
import { MoklyError } from "../errors.js";

type ValidatedManifestEntry = Record<string, unknown> & HierarchyEntry;

/** Validate manifest relationship targets and reciprocal memberships. */
export function validateManifestRelationships(
  entries: readonly Record<string, unknown>[],
  byId: ReadonlyMap<string, Record<string, unknown>>,
): void {
  const hierarchyEntries = entries as readonly ValidatedManifestEntry[];
  const hierarchyIssue = analyzeHierarchy(hierarchyEntries).issues[0];
  if (hierarchyIssue) {
    relationshipError(hierarchyIssue.entry, hierarchyIssue.message);
  }
  validateVariantClaims(entries, byId);
  for (const entry of entries) {
    if (entry.kind === "screen") validateScreen(entry, byId);
    else if (entry.kind === "use-case") validateUseCase(entry, byId);
  }
}

function validateScreen(
  entry: Record<string, unknown>,
  byId: ReadonlyMap<string, Record<string, unknown>>,
): void {
  validateVariantParent(entry, byId);
  for (const useCaseId of entry.useCaseIds as string[]) {
    const useCase = byId.get(useCaseId);
    if (useCase?.kind !== "use-case") {
      relationshipError(
        entry,
        `use-case target is not a use case: ${useCaseId}`,
      );
    }
    const steps = useCase.steps as Array<Record<string, unknown>>;
    if (!steps.some((step) => step.screenId === entry.id)) {
      relationshipError(
        entry,
        `use case ${useCaseId} does not reference this screen`,
      );
    }
  }
}

function validateVariantParent(
  entry: Record<string, unknown>,
  byId: ReadonlyMap<string, Record<string, unknown>>,
): void {
  if (typeof entry.variantOf !== "string") return;
  const parent = byId.get(entry.variantOf);
  if (!parent) relationshipError(entry, "parent screen does not exist");
  if (parent.kind !== "screen")
    relationshipError(entry, "parent is not a screen");
  if (typeof parent.variantOf === "string") {
    relationshipError(entry, "parent is itself a variant");
  }
  if (!isScreenVariantRoute(parent.route as string, entry.route as string)) {
    relationshipError(entry, "route does not match its parent screen");
  }
}

function validateVariantClaims(
  entries: readonly Record<string, unknown>[],
  byId: ReadonlyMap<string, Record<string, unknown>>,
): void {
  for (const collection of entries) {
    if (collection.kind !== "collection") continue;
    for (const childId of collection.childIds as string[]) {
      const child = byId.get(childId);
      if (child?.kind === "screen" && typeof child.variantOf === "string") {
        relationshipError(
          collection,
          `collection ${String(collection.id)} claims variant ${childId}`,
        );
      }
    }
  }
}

function validateUseCase(
  entry: Record<string, unknown>,
  byId: ReadonlyMap<string, Record<string, unknown>>,
): void {
  for (const step of entry.steps as Array<Record<string, unknown>>) {
    const screenId = step.screenId as string;
    const screen = byId.get(screenId);
    if (screen?.kind !== "screen") {
      relationshipError(entry, `step target is not a screen: ${screenId}`);
    }
    if (!(screen.useCaseIds as string[]).includes(entry.id as string)) {
      relationshipError(
        entry,
        `screen ${screenId} does not list this use case`,
      );
    }
  }
}

function relationshipError(
  entry: Record<string, unknown>,
  detail: string,
): never {
  throw new MoklyError(
    "manifest-invalid",
    `${String(entry.id)} has an invalid relationship: ${detail}`,
  );
}
