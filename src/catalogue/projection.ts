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

import { relatedDocumentReferences } from "../documents/references.js";
import { orderEntriesWithVariants } from "../registry/entry_order.js";

import {
  entryChanges,
  entryPreviousPath,
  comparisonSelection,
} from "./changes.js";
import type { CatalogueProjectionInput } from "./projection_input.js";
import { catalogueIdentity, ZERO_DEPLOYMENT_ID } from "./serialization.js";
import { projectViews } from "./views.js";

/** Explicit public allowlist shared by static assembly and live snapshot publication. */
export function projectCatalogue(
  input: CatalogueProjectionInput,
): CatalogueReadModel {
  const { catalogue } = input;
  if (
    catalogue.manifest.schemaVersion !== 9 &&
    catalogue.manifest.schemaVersion !== "live-index-2"
  )
    invalidData(
      "$catalogue",
      "current projection requires manifest v9 or live metadata",
    );
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
      .map((entry) => entry.path),
  );
  const documentReference = relatedDocumentReferences(
    catalogue.manifest.entries,
  );
  const common = (entry: ManifestEntry, removed: boolean): CatalogueEntry => ({
    path: entry.path,
    ...(!removed && entryPreviousPath(entry, input)
      ? { previousPath: entryPreviousPath(entry, input)! }
      : {}),
    title: entry.title,
    tags: [...(entry.tags ?? [])],
    details: {
      description: entry.description,
      sourcePath: repositoryPath(entry.sourcePath),
      relatedDocs: entry.relatedDocs.map((source) => {
        return relatedDoc(removed ? source : documentReference(source));
      }),
      ...(entry.rationale !== undefined ? { rationale: entry.rationale } : {}),
    },
    changes: entryChanges(entry, input, removed),
  });
  const record = (entry: ManifestEntry, removed: boolean): CatalogueRecord => {
    const base = common(entry, removed);
    const pageEvidence =
      input.changesStatus === "ready"
        ? input.evidence?.pageEvidence?.find((item) => item.path === entry.path)
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
    if (entry.kind === "document")
      return {
        ...base,
        kind: "document",
        colorSchemes: [...entry.colorSchemes],
      };
    if (entry.kind === "use-case")
      return {
        ...base,
        kind: "use-case",
        steps: entry.steps.map((step) => ({
          screenPath: step.screenPath,
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
        useCasePaths: [...entry.useCasePaths],
        ...(entry.address !== undefined ? { address: entry.address } : {}),
        ...(entry.variantOf !== undefined
          ? { variantOf: entry.variantOf }
          : {}),
      };
    if (isManifestComponentVariant(entry)) {
      const review = (input.comparison ?? input.evidence?.result)?.components
        .find((item) => item.path === entry.variantOf)
        ?.variants.find((item) => item.path === entry.path);
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
          removed
            ? "removed"
            : review?.state === "removed"
              ? "changed"
              : review?.state,
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
      ? orderEntriesWithVariants<{
          entry: ManifestEntry;
          snapshot?: CatalogueProjectionInput["catalogue"]["removedEntries"][number];
        }>(
          [
            ...catalogue.manifest.entries.map((entry) => ({ entry })),
            ...catalogue.removedEntries.map((snapshot) => ({
              entry: snapshot.entry,
              snapshot,
            })),
          ],
          ({ entry }) => entry,
        ).flatMap(({ snapshot }) => (snapshot ? [snapshot] : []))
      : [];
  const removedPaths = new Set(removedSnapshots.map(({ entry }) => entry.path));
  for (const id of input.removedPreviews?.keys() ?? [])
    if (!removedPaths.has(id))
      invalidData("$catalogue", "preview path is not a removed entry");
  return {
    schemaVersion: 5,
    identity,
    deploymentId: ZERO_DEPLOYMENT_ID,
    revision: {
      content: input.revision.content,
      evidence: input.revision.evidence,
    },
    changesStatus: input.changesStatus,
    comparisonUrl,
    tree: projectTree(catalogue.hierarchy),
    ...(catalogue.hierarchy.order
      ? { treeOrder: [...catalogue.hierarchy.order] }
      : {}),
    screens: entries.filter((entry) => entry.kind === "screen"),
    documents: entries.filter((entry) => entry.kind === "document"),
    pages: entries.filter((entry) => entry.kind === "page"),
    useCases: entries.filter((entry) => entry.kind === "use-case"),
    components: entries.filter((entry) => entry.kind === "component"),
    removedEntries: removedSnapshots.map((snapshot) => ({
      folderTitles: [...snapshot.folderTitles],
      entry: record(snapshot.entry, true),
      ...(snapshot.parentTitle !== undefined
        ? { parentTitle: snapshot.parentTitle }
        : {}),
      ...(snapshotSource
        ? {
            snapshotId: historicalSnapshotId(
              identity.id,
              snapshotSource,
              snapshot.entry,
            ),
          }
        : {}),
      ...projectPreview(
        snapshot.entry,
        input.removedPreviews?.get(snapshot.entry.path),
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
  if (entry.kind === "document" && preview.kind === "document")
    return { preview: { kind: "document" } };
  if (entry.kind !== "page" || preview.kind !== "page")
    invalidData("$catalogue", "page preview requires a removed page");
  return { preview: { kind: "page" } };
}
