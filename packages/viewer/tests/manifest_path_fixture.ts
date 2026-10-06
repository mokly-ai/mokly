/** Type stored test records without changing their values or object identity. */

import type {
  BranchPointPath,
  CurrentPath,
} from "../src/catalogue/path_types.js";
import type { CatalogueUsage } from "../src/catalogue/types.js";
import type {
  ComponentViewRecord,
  ManifestComponent,
  ManifestComponentVariant,
} from "../src/components/manifest_types.js";
import type {
  ManifestDocument,
  ManifestEntry,
  ManifestPage,
  ManifestScreen,
  ManifestUseCase,
  ManifestV8,
} from "../src/registry/types.js";
import type {
  ComponentReview,
  ScreenReviewV5,
} from "../src/review/component_types.js";
import type { Catalogue } from "../src/shell/catalogue.js";
import type { ShellContext } from "../src/shell/context.js";
import type { ShellEvidence } from "../src/shell/metadata.js";

type SidedEntry<
  Entry,
  Path extends string,
  Reference extends string,
> = Entry extends ManifestComponentVariant
  ? ManifestComponentVariant<Path, Reference>
  : Entry extends ManifestComponent
    ? ManifestComponent<Path>
    : Entry extends ManifestScreen
      ? ManifestScreen<Path, Reference>
      : Entry extends ManifestUseCase
        ? ManifestUseCase<Path, Reference>
        : Entry extends ManifestPage
          ? ManifestPage<Path>
          : Entry extends ManifestDocument
            ? ManifestDocument<Path>
            : never;

export function currentManifestEntryFixture<Entry extends ManifestEntry>(
  entry: Entry,
): SidedEntry<Entry, CurrentPath, CurrentPath> {
  return entry as unknown as SidedEntry<Entry, CurrentPath, CurrentPath>;
}

export function removedManifestEntryFixture<Entry extends ManifestEntry>(
  entry: Entry,
): SidedEntry<Entry, CurrentPath, BranchPointPath> {
  return entry as unknown as SidedEntry<Entry, CurrentPath, BranchPointPath>;
}

export function baselineManifestEntryFixture<Entry extends ManifestEntry>(
  entry: Entry,
): SidedEntry<Entry, BranchPointPath, BranchPointPath> {
  return entry as unknown as SidedEntry<
    Entry,
    BranchPointPath,
    BranchPointPath
  >;
}

export function baselineManifestFixture(
  manifest: ManifestV8,
): ManifestV8<BranchPointPath> {
  return manifest as ManifestV8<BranchPointPath>;
}

export function shellEvidenceFixture(
  evidence: ShellEvidence<string>,
): ShellEvidence {
  return evidence as unknown as ShellEvidence;
}

export function currentIdentityFixture<const Entry extends { path: string }>(
  entry: Entry,
): Omit<Entry, "path"> & { path: CurrentPath } {
  return entry as unknown as Omit<Entry, "path"> & { path: CurrentPath };
}

export function baselineIdentityFixture<const Entry extends { path: string }>(
  entry: Entry,
): Omit<Entry, "path"> & { path: BranchPointPath } {
  return entry as unknown as Omit<Entry, "path"> & { path: BranchPointPath };
}

export function shellHierarchyFixture(
  hierarchy: Catalogue<string>["hierarchy"],
): Catalogue["hierarchy"] {
  return hierarchy as Catalogue["hierarchy"];
}

export function currentUsageFixture(
  usage: CatalogueUsage<string>,
): CatalogueUsage {
  return usage as CatalogueUsage;
}

export function currentViewFixture(
  view: ComponentViewRecord,
): ComponentViewRecord<CurrentPath> {
  return view as ComponentViewRecord<CurrentPath>;
}

export function componentReviewFixture(
  review: ComponentReview,
): ComponentReview<CurrentPath, BranchPointPath> {
  return review as ComponentReview<CurrentPath, BranchPointPath>;
}

export function screenReviewFixture(
  review: ScreenReviewV5,
): ScreenReviewV5<CurrentPath, BranchPointPath> {
  return review as ScreenReviewV5<CurrentPath, BranchPointPath>;
}

export function shellContextFixture(
  context: Omit<ShellContext, "componentChanges"> & {
    componentChanges?: ShellEvidence<string>;
  },
): ShellContext {
  return context as unknown as ShellContext;
}
