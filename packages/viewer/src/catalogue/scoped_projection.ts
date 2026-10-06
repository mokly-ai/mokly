/** Deterministic projection from a complete public catalogue to one shell entry. */

import type {
  ShellCatalogueReadModel,
  ShellCatalogueRoutedEntry,
  ShellCatalogueScreen,
  ShellCatalogueUsage,
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

const OMITTED_USAGE: ShellCatalogueUsage = { status: "omitted" };

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

function projectScreen(
  screen: CatalogueScreen,
  scope: ReadonlySet<CatalogueView>,
): ShellCatalogueScreen {
  return {
    ...screen,
    views: screen.views.map((view) => projectView(view, scope)),
  };
}

function projectComponent(
  component: CatalogueComponent | CatalogueComponentVariant,
  scope: ReadonlySet<CatalogueView>,
): CatalogueComponent | ShellCatalogueVariant {
  return "variantOf" in component
    ? {
        ...component,
        views: component.views.map((view) => projectView(view, scope)),
      }
    : component;
}

function projectEntry(
  entry: CatalogueRecord,
  scope: ReadonlySet<CatalogueView>,
): ShellCatalogueRoutedEntry {
  if (entry.kind === "screen") return projectScreen(entry, scope);
  if (entry.kind === "component") return projectComponent(entry, scope);
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
