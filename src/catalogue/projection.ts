import type {
  CatalogueCollection,
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
  lexical,
  publicPath,
  pagePreviewPath,
  relatedDoc,
  repositoryPath,
} from "@mokly/viewer/data";

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
    catalogue.manifest.schemaVersion !== 5 &&
    catalogue.manifest.schemaVersion !== "live-index-1"
  )
    invalidData(
      "$catalogue",
      "current projection requires manifest v5 or live metadata",
    );
  const common = (entry: ManifestEntry, removed: boolean): CatalogueEntry => ({
    id: entry.id,
    title: entry.title,
    tags: entry.kind === "collection" ? [] : [...(entry.tags ?? [])],
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
    entry: Exclude<ManifestEntry, { kind: "collection" }>,
    removed: boolean,
  ): CatalogueRoutedEntry => {
    const base = common(entry, removed);
    if (entry.kind === "page")
      return {
        ...base,
        kind: "page",
        route: entry.route,
        documentPath: removed ? null : publicPath(`static/${entry.route}`),
      };
    if (entry.kind === "use-case")
      return {
        ...base,
        kind: "use-case",
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
        route: entry.route,
        viewports: [...entry.viewports],
        colorSchemes: entry.darkFragments ? ["light", "dark"] : ["light"],
        views: projectViews(input, retainedComponents, entry, entry, removed),
        useCaseIds: [...entry.useCaseIds],
        ...(entry.address !== undefined ? { address: entry.address } : {}),
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
  const collections: CatalogueCollection[] = [];
  const entries: CatalogueRoutedEntry[] = [];
  for (const entry of [...catalogue.manifest.entries].sort(entryOrder)) {
    if (entry.kind === "collection")
      collections.push({
        ...common(entry, false),
        kind: "collection",
        childIds: [...entry.childIds],
      });
    else entries.push(routed(entry, false));
  }
  const removedSnapshots =
    input.changesStatus === "ready"
      ? [...catalogue.removedEntries].sort((a, b) =>
          entryOrder(a.entry, b.entry),
        )
      : [];
  const removedRoutes = new Set(
    removedSnapshots.map(({ entry }) => entry.route),
  );
  for (const route of input.removedPreviews?.keys() ?? [])
    if (!removedRoutes.has(route))
      invalidData("$catalogue", "preview route is not a removed entry");
  return {
    schemaVersion: 1,
    identity: catalogueIdentity(input.configPath),
    deploymentId: ZERO_DEPLOYMENT_ID,
    revision: {
      content: input.revision.content,
      evidence: input.revision.evidence,
    },
    changesStatus: input.changesStatus,
    comparisonUrl,
    collections,
    tree: projectTree(catalogue.hierarchy),
    screens: entries.filter((entry) => entry.kind === "screen"),
    pages: entries.filter((entry) => entry.kind === "page"),
    useCases: entries.filter((entry) => entry.kind === "use-case"),
    components: entries.filter((entry) => entry.kind === "component"),
    removedEntries: removedSnapshots.map(({ entry, ancestors }) => ({
      entry: routed(entry, true),
      ancestors: ancestors.map((ancestor) => ({
        id: ancestor.id,
        title: ancestor.title,
      })),
      ...projectPreview(
        entry,
        input.removedPreviews?.get(entry.route),
        comparisonUrl,
      ),
    })),
  };
}

function projectPreview(
  entry: Exclude<ManifestEntry, { kind: "collection" }>,
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

function entryOrder(left: ManifestEntry, right: ManifestEntry): number {
  return (
    lexical(
      left.kind === "collection" ? "" : left.route,
      right.kind === "collection" ? "" : right.route,
    ) || lexical(left.id, right.id)
  );
}
