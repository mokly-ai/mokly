/** Deterministic projection from a complete public catalogue to one shell entry. */

import type { BranchPointPath, CurrentPath } from "./path_types.js";
import type {
  ShellCatalogueReadModel,
  ShellCatalogueRoutedEntry,
  ShellCatalogueScreen,
  ShellCatalogueVariant,
  ShellCatalogueView,
} from "./scoped_types.js";
import type {
  CatalogueReadModel,
  CatalogueComponent,
  CatalogueComponentVariant,
  CatalogueRecord,
  CatalogueScreen,
  CatalogueView,
} from "./types.js";
import {
  resolveCatalogueUsageScope,
  type CatalogueUsageScopeTarget,
} from "./usage_scope.js";

const OMITTED_USAGE = { status: "omitted" as const };

/** Retain all index data while replacing out-of-scope usage with `omitted`. */
export function projectScopedCatalogue(
  model: CatalogueReadModel,
  target: CatalogueUsageScopeTarget,
): ShellCatalogueReadModel {
  const scope = resolveCatalogueUsageScope(model, target);
  return {
    ...model,
    screens: model.screens.map((screen) => projectScreen(screen, scope)),
    components: model.components.map((component) =>
      projectComponent(component, scope),
    ),
    removedEntries: model.removedEntries.map((record) => ({
      ...record,
      entry: projectEntry(record.entry, scope),
    })),
  };
}

function projectScreen<Reference extends CurrentPath | BranchPointPath>(
  screen: CatalogueScreen<CurrentPath, Reference>,
  scope: ReadonlySet<CatalogueView<CurrentPath | BranchPointPath>>,
): ShellCatalogueScreen<CurrentPath, Reference> {
  return {
    ...screen,
    views: screen.views.map((view) => projectView(view, scope)),
  };
}

function projectComponent<Reference extends CurrentPath | BranchPointPath>(
  component:
    CatalogueComponent | CatalogueComponentVariant<CurrentPath, Reference>,
  scope: ReadonlySet<CatalogueView<CurrentPath | BranchPointPath>>,
): CatalogueComponent | ShellCatalogueVariant<CurrentPath, Reference> {
  return "variantOf" in component
    ? {
        ...component,
        views: component.views.map((view) => projectView(view, scope)),
      }
    : component;
}

function projectEntry<Reference extends CurrentPath | BranchPointPath>(
  entry: CatalogueRecord<CurrentPath, Reference>,
  scope: ReadonlySet<CatalogueView<CurrentPath | BranchPointPath>>,
): ShellCatalogueRoutedEntry<CurrentPath, Reference> {
  if (entry.kind === "screen") return projectScreen(entry, scope);
  if (entry.kind === "component") return projectComponent(entry, scope);
  return entry;
}

function projectView<Reference extends CurrentPath | BranchPointPath>(
  view: CatalogueView<Reference>,
  scope: ReadonlySet<CatalogueView<CurrentPath | BranchPointPath>>,
): ShellCatalogueView<Reference> {
  return {
    ...view,
    usage: scope.has(view) ? view.usage : OMITTED_USAGE,
  };
}
