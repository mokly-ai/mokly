import type {
  CatalogueEntry,
  CatalogueReadModel,
  CatalogueRecord,
  RemovedEntryPreview,
} from "@mokly/viewer";
import type { ManifestEntry } from "@mokly/viewer/data";
import {
  invalidData,
  isManifestComponentVariant,
  readControls,
  readProps,
  readSchema,
  projectTree,
  comparisonPath,
  comparisonGeneration,
  historicalSnapshotId,
  relatedDoc,
  repositoryPath,
} from "@mokly/viewer/data";

import { orderEntriesWithVariants } from "../registry/entry_order.js";

import { entryChanges, comparisonSelection } from "./changes.js";
import type { CatalogueProjectionInput } from "./projection_input.js";
import { catalogueIdentity, ZERO_DEPLOYMENT_ID } from "./serialization.js";
import { projectViews } from "./views.js";

/** Explicit public allowlist shared by static assembly and live snapshot publication. */
export function projectCatalogue(
  input: CatalogueProjectionInput,
): CatalogueReadModel {
  const { catalogue } = input;
  const comparisonUrl = comparisonPath(input.comparisonUrl);
  const identity = catalogueIdentity(input.configPath);
  const snapshotSource = historicalSource(input, comparisonUrl);
  const retainedComponents = new Set(
    [
      ...catalogue.manifest.entries,
      ...(input.changesStatus === "ready"
        ? catalogue.removedEntries.map(({ entry }) => entry)
        : []),
    ]
      .filter(
        (entry) =>
          entry.kind === "component" && !isManifestComponentVariant(entry),
      )
      .map((entry) => entry.id),
  );
  if (
    catalogue.manifest.schemaVersion !== 8 &&
    catalogue.manifest.schemaVersion !== "live-index-1"
  )
    invalidData(
      "$catalogue",
      "current projection requires manifest v8 or live metadata",
    );
  const common = (entry: ManifestEntry, removed: boolean): CatalogueEntry => ({
    id: entry.id,
    title: entry.title,
    tags: [...(entry.tags ?? [])],
    navPath: [...entry.navPath],
    details: {
      description: entry.description,
      sourcePath: repositoryPath(entry.sourcePath),
      relatedDocs: entry.relatedDocs.map(relatedDoc),
      ...(entry.rationale !== undefined ? { rationale: entry.rationale } : {}),
    },
    changes: entryChanges(entry, input, removed),
  });
  const record = (entry: ManifestEntry, removed: boolean): CatalogueRecord => {
    const base = common(entry, removed);
    const pageEvidence =
      input.changesStatus === "ready"
        ? input.evidence?.pageEvidence?.find((item) => item.id === entry.id)
        : undefined;
    if (entry.kind === "page")
      return {
        ...base,
        kind: "page",
        ...(pageEvidence
          ? {
              resourceEvidence: {
                ...(pageEvidence.reasons
                  ? { reasons: pageEvidence.reasons }
                  : {}),
                ...(pageEvidence.excludedResources
                  ? { excludedResources: pageEvidence.excludedResources }
                  : {}),
              },
            }
          : {}),
      };
    if (entry.kind === "use-case")
      return {
        ...base,
        kind: "use-case",
        steps: entry.steps.map((step) => ({
          screenId: step.screenId,
          ...(step.title !== undefined ? { title: step.title } : {}),
          ...(step.description !== undefined
            ? { description: step.description }
            : {}),
        })),
      };
    if (entry.kind === "screen")
      return {
        ...base,
        kind: "screen",
        colorSchemes: [...entry.colorSchemes],
        views: projectViews(input, retainedComponents, entry, removed),
        useCaseIds: [...entry.useCaseIds],
        ...(entry.address !== undefined ? { address: entry.address } : {}),
        ...(entry.variantOf !== undefined
          ? { variantOf: entry.variantOf }
          : {}),
      };
    if (isManifestComponentVariant(entry)) {
      const review = (input.comparison ?? input.evidence?.result)?.components
        .find((item) => item.id === entry.variantOf)
        ?.variants.find((item) => item.id === entry.id);
      return {
        ...base,
        kind: "component",
        colorSchemes: [...entry.colorSchemes],
        variantOf: entry.variantOf,
        props: readProps(entry.props),
        suppliedSlots: [...entry.suppliedSlots],
        views: projectViews(input, retainedComponents, entry, removed),
        comparison: comparisonSelection(
          input,
          removed ? "removed" : review?.state,
          true,
        ),
      };
    }
    const schema = readSchema(entry.propSchema);
    if (schema.kind !== "object")
      invalidData("$catalogue", "expected object schema");
    return {
      ...base,
      kind: "component",
      colorSchemes: [...entry.colorSchemes],
      propSchema: schema,
      slots: [...entry.slots],
      controls: readControls(entry.controls, schema),
    };
  };
  const entries: CatalogueRecord[] = orderEntriesWithVariants(
    catalogue.manifest.entries,
    (value) => value,
  ).map((entry) => record(entry, false));
  const removedSnapshots =
    input.changesStatus === "ready"
      ? orderEntriesWithVariants(
          [
            ...catalogue.manifest.entries.map((entry) => ({ entry })),
            ...catalogue.removedEntries.map((snapshot) => ({
              ...snapshot,
              removed: true as const,
            })),
          ],
          ({ entry }) => entry,
        ).flatMap((item) => ("removed" in item ? [item] : []))
      : [];
  const removedIds = new Set(removedSnapshots.map(({ entry }) => entry.id));
  for (const id of input.removedPreviews?.keys() ?? [])
    if (!removedIds.has(id))
      invalidData("$catalogue", "preview id is not a removed entry");
  return {
    schemaVersion: 4,
    identity,
    deploymentId: ZERO_DEPLOYMENT_ID,
    revision: {
      content: input.revision.content,
      evidence: input.revision.evidence,
    },
    changesStatus: input.changesStatus,
    comparisonUrl,
    tree: projectTree(catalogue.hierarchy),
    screens: entries.filter((entry) => entry.kind === "screen"),
    pages: entries.filter((entry) => entry.kind === "page"),
    useCases: entries.filter((entry) => entry.kind === "use-case"),
    components: entries.filter((entry) => entry.kind === "component"),
    removedEntries: removedSnapshots.map(({ entry }) => ({
      entry: record(entry, true),
      ...(snapshotSource
        ? {
            snapshotId: historicalSnapshotId(
              identity.id,
              snapshotSource,
              entry,
            ),
          }
        : {}),
      ...projectPreview(
        entry,
        input.removedPreviews?.get(entry.id),
        comparisonUrl,
      ),
    })),
  };
}

function historicalSource(
  input: CatalogueProjectionInput,
  comparisonUrl: string | null,
) {
  const commits = new Set(
    [
      input.evidence?.comparison?.baseCommit,
      input.evidence?.result?.baseCommit,
      input.comparison?.baseCommit,
    ].filter((value): value is string => value !== undefined),
  );
  if (commits.size > 1)
    invalidData("$catalogue", "conflicting historical baseline identities");
  const [commit] = commits;
  if (commit) return { kind: "baseline" as const, identity: commit };
  const generation = comparisonGeneration(comparisonUrl);
  return generation
    ? { kind: "generation" as const, identity: generation }
    : undefined;
}

function projectPreview(
  entry: ManifestEntry,
  preview: RemovedEntryPreview | undefined,
  comparisonUrl: string | null,
): { preview?: RemovedEntryPreview } {
  if (!preview) return {};
  if (!comparisonUrl)
    invalidData("$catalogue", "preview requires a comparison URL");
  if (preview.kind === "screen") {
    if (entry.kind !== "screen")
      invalidData("$catalogue", "screen preview requires a removed screen");
    return { preview: { kind: "screen" } };
  }
  if (entry.kind !== "page")
    invalidData("$catalogue", "page preview requires a removed page");
  return { preview: { kind: "page" } };
}
