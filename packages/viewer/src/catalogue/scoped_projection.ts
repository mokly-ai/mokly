/** Deterministic projection from a complete public catalogue to one shell route. */

import type {
  ShellCatalogueReadModel,
  ShellCatalogueRoutedEntry,
  ShellCatalogueUsage,
  ShellCatalogueView,
} from "./scoped_types.js";
import type {
  CatalogueReadModel,
  CatalogueRoutedEntry,
  CatalogueView,
} from "./types.js";
import {
  resolveCatalogueUsageScope,
  type CatalogueUsageScopeTarget,
} from "./usage_scope.js";

const OMITTED_USAGE: ShellCatalogueUsage = { status: "omitted" };

/** Retain all index data while replacing out-of-scope usage with `omitted`. */
export function projectScopedCatalogue(
  model: CatalogueReadModel,
  target: CatalogueUsageScopeTarget,
): ShellCatalogueReadModel {
  const scope = resolveCatalogueUsageScope(model, target);
  return {
    ...model,
    screens: model.screens.map((screen) => ({
      ...screen,
      views: screen.views.map((view) => projectView(view, scope)),
    })),
    components: model.components.map((component) => ({
      ...component,
      variants: component.variants.map((variant) => ({
        ...variant,
        views: variant.views.map((view) => projectView(view, scope)),
      })),
    })),
    removedEntries: model.removedEntries.map((record) => ({
      ...record,
      entry: projectEntry(record.entry, scope),
    })),
  };
}

function projectEntry(
  entry: CatalogueRoutedEntry,
  scope: ReadonlySet<CatalogueView>,
): ShellCatalogueRoutedEntry {
  if (entry.kind === "screen")
    return {
      ...entry,
      views: entry.views.map((view) => projectView(view, scope)),
    };
  if (entry.kind === "component")
    return {
      ...entry,
      variants: entry.variants.map((variant) => ({
        ...variant,
        views: variant.views.map((view) => projectView(view, scope)),
      })),
    };
  return entry;
}

function projectView(
  view: CatalogueView,
  scope: ReadonlySet<CatalogueView>,
): ShellCatalogueView {
  return {
    ...view,
    usage: scope.has(view) ? view.usage : OMITTED_USAGE,
  };
}
