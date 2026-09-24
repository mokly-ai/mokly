import type {
  CatalogueEntry,
  CatalogueReadModel,
  CatalogueRoutedEntry,
  CatalogueVariant,
  RemovedEntryPreview,
} from "@mokly/viewer";
import type { ManifestEntry } from "@mokly/viewer/data";
import {
  invalidData,
  readControls,
  readProps,
  readSchema,
  projectTree,
  comparisonPath,
  comparisonGeneration,
  historicalSnapshotId,
  publicPath,
  pagePreviewPath,
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
      .filter((entry) => entry.kind === "component")
      .map((entry) => entry.id),
  );
  if (
    catalogue.manifest.schemaVersion !== 6 &&
    catalogue.manifest.schemaVersion !== "live-index-1"
  )
    invalidData(
      "$catalogue",
      "current projection requires manifest v6 or live metadata",
    );
  const common = (entry: ManifestEntry, removed: boolean): CatalogueEntry => ({
    id: entry.id,
    title: entry.title,
    tags: [...(entry.tags ?? [])],
    details: {
      description: entry.description,
      sourcePath: repositoryPath(entry.sourcePath),
      relatedDocs: entry.relatedDocs.map(relatedDoc),
      dependencies: entry.dependencies.map(repositoryPath).sort(),
      ...(entry.rationale !== undefined ? { rationale: entry.rationale } : {}),
    },
    changes: entryChanges(entry, input, removed),
  });
  const routed = (
    entry: ManifestEntry,
    removed: boolean,
  ): CatalogueRoutedEntry => {
    const base = common(entry, removed);
    if (entry.kind === "page")
      return {
        ...base,
        kind: "page",
        navPath: entry.navPath,
        route: entry.route,
        documentPath: removed ? null : publicPath(`static/${entry.route}`),
      };
    if (entry.kind === "use-case")
      return {
        ...base,
        kind: "use-case",
        navPath: entry.navPath,
        route: entry.route,
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
        navPath: entry.navPath,
        route: entry.route,
        viewports: [...entry.viewports],
        colorSchemes: entry.darkFragments ? ["light", "dark"] : ["light"],
        views: projectViews(input, retainedComponents, entry, entry, removed),
        useCaseIds: [...entry.useCaseIds],
        ...(entry.address !== undefined ? { address: entry.address } : {}),
        ...(entry.variantOf !== undefined
          ? { variantOf: entry.variantOf }
          : {}),
      };
    const schema = readSchema(entry.propSchema);
    if (schema.kind !== "object")
      invalidData("$catalogue", "expected object schema");
    const previous = input.evidence?.baseline.entries.find(
      (item) => item.kind === "component" && item.id === entry.id,
    );
    const oldVariants =
      previous?.kind === "component"
        ? previous.variants.filter(
            (item) => !entry.variants.some((current) => current.id === item.id),
          )
        : [];
    const variants: CatalogueVariant[] = [
      ...entry.variants,
      ...oldVariants,
    ].map((variant) => {
      const missing = removed || oldVariants.includes(variant);
      const review = (
        input.comparison?.schemaVersion === 3
          ? input.comparison
          : input.evidence?.result
      )?.components
        .find((item) => item.id === entry.id)
        ?.variants.find((item) => item.id === variant.id);
      return {
        id: variant.id,
        title: variant.title,
        props: readProps(variant.props),
        suppliedSlots: [...variant.suppliedSlots],
        views: projectViews(
          input,
          retainedComponents,
          entry,
          variant,
          missing,
          variant.id,
        ),
        comparison: comparisonSelection(
          input,
          missing ? "removed" : review?.state,
          true,
        ),
        ...(variant.description !== undefined
          ? { description: variant.description }
          : {}),
      };
    });
    return {
      ...base,
      kind: "component",
      navPath: entry.navPath,
      route: entry.route,
      viewports: [...entry.viewports],
      colorSchemes: entry.variants[0]?.darkFragments
        ? ["light", "dark"]
        : ["light"],
      propSchema: schema,
      slots: [...entry.slots],
      controls: readControls(entry.controls, schema),
      variants,
    };
  };
  const entries: CatalogueRoutedEntry[] = orderEntriesWithVariants(
    catalogue.manifest.entries,
    (value) => value,
  ).map((entry) => routed(entry, false));
  const removedSnapshots =
    input.changesStatus === "ready"
      ? orderEntriesWithVariants(catalogue.removedEntries, ({ entry }) => entry)
      : [];
  const removedRoutes = new Set(
    removedSnapshots.map(({ entry }) => entry.route),
  );
  for (const route of input.removedPreviews?.keys() ?? [])
    if (!removedRoutes.has(route))
      invalidData("$catalogue", "preview route is not a removed entry");
  return {
    schemaVersion: 2,
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
      entry: routed(entry, true),
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
        input.removedPreviews?.get(entry.route),
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
  const previewPath = pagePreviewPath(preview.path);
  const generation = comparisonUrl.slice(0, -"review.json".length);
  if (previewPath !== `${generation}pages/${entry.route}.json`)
    invalidData(
      "$catalogue",
      "page preview must match comparison generation and route",
    );
  return { preview: { kind: "page", path: previewPath } };
}
