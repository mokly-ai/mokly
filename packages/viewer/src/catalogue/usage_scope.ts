/** Pure entry-to-usage scope resolution shared by projection and validation. */

import { invalidData } from "../components/data.js";

import {
  catalogueComponentVariants,
  resolveCatalogueEntry,
} from "./entry_selection.js";
import type {
  ShellCatalogueReadModel,
  ShellCatalogueRoutedEntry,
  ShellCatalogueView,
} from "./scoped_types.js";
import type {
  CatalogueReadModel,
  CatalogueRecord,
  CatalogueView,
} from "./types.js";

/** The bootstrap-owned selection fields that determine retained usage. */
export type CatalogueUsageScopeTarget =
  | { readonly kind: "home" }
  | { readonly kind: "missing"; readonly requested: string }
  | {
      readonly kind: "target";
      readonly entryPath: string;
      readonly entryKind: CatalogueRecord["kind"];
      readonly snapshotId?: string;
    };

type ScopedEntry = CatalogueRecord | ShellCatalogueRoutedEntry;
type ScopedView = CatalogueView | ShellCatalogueView;
interface ScopeCatalogue {
  screens: readonly ScopedEntry[];
  documents: readonly ScopedEntry[];
  pages: readonly ScopedEntry[];
  useCases: readonly ScopedEntry[];
  components: readonly ScopedEntry[];
  removedEntries: readonly {
    entry: ScopedEntry;
    snapshotId?: string;
  }[];
}

/** Resolve the exact view objects whose real usage one bootstrap may carry. */
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
  const resolved = resolveCatalogueEntry(
    model,
    { path: target.entryPath, kind: target.entryKind },
    target.snapshotId,
  );
  if (!resolved) invalidData("$bootstrap", "invalid shell hydration target");
  const entry = resolved.entry;
  const historical = model.removedEntries.some(
    (record) => record.entry === entry,
  );
  if (entry.kind === "screen") addViews(scope, entry.views);
  if (entry.kind === "component") {
    const parentPath = "variantOf" in entry ? entry.variantOf : entry.path;
    for (const variant of catalogueComponentVariants(model, parentPath))
      addViews(scope, variant.views);
  }
  if (entry.kind === "use-case" && !historical) {
    const screenPaths = new Set(entry.steps.map((step) => step.screenPath));
    for (const screen of model.screens)
      if (screen.kind === "screen" && screenPaths.has(screen.path))
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

/** Whether a shell catalogue withholds any view usage from this entry. */
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

function entryViews(entry: ScopedEntry): readonly ScopedView[] {
  if (entry.kind === "screen") return entry.views;
  if (entry.kind === "component" && "variantOf" in entry) return entry.views;
  return [];
}
