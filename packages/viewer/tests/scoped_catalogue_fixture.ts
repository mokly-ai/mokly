import fs from "node:fs";

import { readCatalogue } from "../src/catalogue/reader.js";
import type {
  CatalogueComponent,
  CatalogueComponentVariant,
  CatalogueReadModel,
} from "../src/catalogue/types.js";

type Mutable<Value> = Value extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : Value extends object
    ? { -readonly [Key in keyof Value]: Mutable<Value[Key]> }
    : Value;
type MutableCatalogue = Mutable<CatalogueReadModel>;

/** Build a valid fixture covering every entry-scoping shape. */
export function scopedCatalogueFixture(): CatalogueReadModel {
  const value = JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v3.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as MutableCatalogue;
  addRemovedVariant(value);
  addRemovedComponent(value);
  addRemovedUseCase(value);
  const useCase = value.useCases[0]!;
  useCase.steps.push(structuredClone(useCase.steps[0]!));
  return readCatalogue(value);
}

function addRemovedVariant(value: MutableCatalogue): void {
  const variant = structuredClone(
    value.components.find(
      (entry): entry is Mutable<CatalogueComponentVariant> =>
        "variantOf" in entry,
    )!,
  );
  variant.id = "action-retired";
  variant.title = "Retired";
  variant.changes = { included: true, kind: "removed", status: "ready" };
  variant.comparison = {
    eligible: true,
    kind: "removed",
    status: "ready",
  };
  value.removedEntries.push({
    entry: variant,
    snapshotId: "c".repeat(64),
  });
}

function addRemovedComponent(value: MutableCatalogue): void {
  const parent = structuredClone(
    value.components.find(
      (entry): entry is Mutable<CatalogueComponent> => !("variantOf" in entry),
    )!,
  );
  parent.id = "removed-action";
  parent.title = "Removed action";
  parent.changes = { included: true, kind: "removed", status: "ready" };
  const sourceVariant = value.components.find(
    (entry): entry is Mutable<CatalogueComponentVariant> =>
      "variantOf" in entry,
  )!;
  const variant = structuredClone(sourceVariant);
  variant.id = "removed-action-default";
  variant.title = "Default";
  variant.variantOf = parent.id;
  variant.changes = { included: true, kind: "removed", status: "ready" };
  variant.comparison = {
    eligible: true,
    kind: "removed",
    status: "ready",
  };
  value.removedEntries.push(
    { entry: parent, snapshotId: "d".repeat(64) },
    { entry: variant, snapshotId: "f".repeat(64) },
  );
}

function addRemovedUseCase(value: MutableCatalogue): void {
  const useCase = structuredClone(value.useCases[0]!);
  useCase.id = "removed-tour";
  useCase.title = "Removed tour";
  useCase.changes = { included: true, kind: "removed", status: "ready" };
  value.removedEntries.push({
    entry: useCase,
    snapshotId: "e".repeat(64),
  });
}
