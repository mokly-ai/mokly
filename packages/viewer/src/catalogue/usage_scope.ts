/** Pure route-to-usage scope resolution shared by projection and validation. */

import { invalidData } from "../components/data.js";

import { resolveCatalogueRoute } from "./entry_selection.js";
import type {
  ShellCatalogueReadModel,
  ShellCatalogueRoutedEntry,
  ShellCatalogueView,
} from "./scoped_types.js";
import type {
  CatalogueReadModel,
  CatalogueRoutedEntry,
  CatalogueView,
} from "./types.js";

/** The bootstrap-owned selection fields that determine retained usage. */
export type CatalogueUsageScopeTarget =
  | { readonly kind: "home" }
  | { readonly kind: "missing"; readonly requested: string }
  | {
      readonly kind: "target";
      readonly route: string;
      readonly snapshotId?: string;
    };

type ScopedRoutedEntry = CatalogueRoutedEntry | ShellCatalogueRoutedEntry;
type ScopedView = CatalogueView | ShellCatalogueView;
interface ScopeCatalogue {
  screens: readonly ScopedRoutedEntry[];
  pages: readonly ScopedRoutedEntry[];
  useCases: readonly ScopedRoutedEntry[];
  components: readonly ScopedRoutedEntry[];
  removedEntries: readonly {
    entry: ScopedRoutedEntry;
    snapshotId?: string;
  }[];
}

/** Resolve the exact view objects whose real usage one route may carry. */
export function resolveCatalogueUsageScope(
  model: CatalogueReadModel,
  target: CatalogueUsageScopeTarget,
): ReadonlySet<CatalogueView>;
/** Resolve scope after parsing a shell catalogue that may contain omissions. */
export function resolveCatalogueUsageScope(
  model: ShellCatalogueReadModel,
  target: CatalogueUsageScopeTarget,
): ReadonlySet<ShellCatalogueView>;
export function resolveCatalogueUsageScope(
  model: ScopeCatalogue,
  target: CatalogueUsageScopeTarget,
): ReadonlySet<ScopedView> {
  const scope = new Set<ScopedView>();
  if (target.kind !== "target") return scope;
  const resolved = resolveCatalogueRoute(
    model,
    target.route,
    target.snapshotId,
  );
  if (!resolved) invalidData("$bootstrap", "invalid shell hydration target");
  const entry = resolved.entry;
  const historical = model.removedEntries.some(
    (record) => record.entry === entry,
  );
  if (entry.kind === "screen") addViews(scope, entry.views);
  if (entry.kind === "component")
    for (const variant of entry.variants) addViews(scope, variant.views);
  if (entry.kind === "use-case" && !historical) {
    const screenIds = new Set(entry.steps.map((step) => step.screenId));
    for (const screen of model.screens)
      if (screen.kind === "screen" && screenIds.has(screen.id))
        addViews(scope, screen.views);
  }
  return scope;
}

/** Enumerate every usage-bearing view in current and historical index order. */
export function catalogueUsageViews(
  model: CatalogueReadModel,
): readonly CatalogueView[];
/** Enumerate every usage-bearing view after shell-only usage parsing. */
export function catalogueUsageViews(
  model: ShellCatalogueReadModel,
): readonly ShellCatalogueView[];
export function catalogueUsageViews(
  model: ScopeCatalogue,
): readonly ScopedView[] {
  return [
    ...model.screens.flatMap((screen) => entryViews(screen)),
    ...model.components.flatMap((component) => entryViews(component)),
    ...model.removedEntries.flatMap(({ entry }) => entryViews(entry)),
  ];
}

/** Whether a shell catalogue withholds any view usage from this route. */
export function catalogueHasOmittedUsage(
  model: ShellCatalogueReadModel,
): boolean {
  return catalogueUsageViews(model).some(
    (view) => view.usage.status === "omitted",
  );
}

function addViews(target: Set<ScopedView>, views: readonly ScopedView[]): void {
  for (const view of views) target.add(view);
}

function entryViews(entry: ScopedRoutedEntry): readonly ScopedView[] {
  if (entry.kind === "screen") return entry.views;
  if (entry.kind === "component")
    return entry.variants.flatMap((variant) => variant.views);
  return [];
}
