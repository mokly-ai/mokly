import { branchPoints } from "../src/catalogue/branch_point.js";
import { catalogueComponentVariants } from "../src/catalogue/entry_selection.js";
import type {
  BranchPointPath,
  CurrentPath,
} from "../src/catalogue/path_types.js";
import { readBranchPointPath } from "../src/catalogue/path_values.js";
import type {
  CatalogueReadModel,
  CatalogueRecord,
  CatalogueScreen,
  CatalogueComponentVariant,
  CatalogueUseCase,
} from "../src/catalogue/types.js";
import type { ReviewResult, TypedReviewResult } from "../src/review/types.js";

/** Assign fixture reference sides without validating deliberately invalid evidence. */
export function typedReviewFixture(result: ReviewResult): TypedReviewResult {
  return result as unknown as TypedReviewResult;
}

type HistoricalEntry<Entry> = Entry extends CatalogueScreen
  ? CatalogueScreen<CurrentPath, BranchPointPath>
  : Entry extends CatalogueComponentVariant
    ? CatalogueComponentVariant<CurrentPath, BranchPointPath>
    : Entry extends CatalogueUseCase
      ? CatalogueUseCase<CurrentPath, BranchPointPath>
      : Entry;

/** Copy a fixture's reference side when retaining it as a removed record. */
export function historicalEntry<Entry extends CatalogueRecord>(
  entry: Entry,
): HistoricalEntry<Entry> {
  return entry as unknown as HistoricalEntry<Entry>;
}

/** Select a current fixture variant without merging its historical view type. */
export function currentVariant(
  model: CatalogueReadModel,
  parent: CurrentPath,
): CatalogueComponentVariant {
  const entry = model.components.find(
    (entry): entry is CatalogueComponentVariant =>
      "variantOf" in entry && entry.variantOf === parent,
  );
  if (!entry) throw new Error(`Missing current variant of ${parent}`);
  return entry;
}

/** Resolve a fixture's recorded name before collecting its destination variants. */
export function fixtureVariantsAt(model: CatalogueReadModel, path: string) {
  const destination = branchPoints<
    CatalogueRecord,
    CatalogueReadModel["removedEntries"][number]
  >(model).resolve({
    kind: "component",
    path: readBranchPointPath(path),
    side: "before",
  });
  return destination
    ? catalogueComponentVariants(model, destination.entry)
    : [];
}

/** Current-only variants for fixtures that edit current metadata. */
export function currentVariants(
  model: CatalogueReadModel,
  parent: CurrentPath,
): CatalogueComponentVariant[] {
  return model.components.filter(
    (entry): entry is CatalogueComponentVariant =>
      "variantOf" in entry && entry.variantOf === parent,
  );
}
