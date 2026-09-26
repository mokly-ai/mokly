import fs from "node:fs";

import { readCatalogue } from "../src/catalogue/reader.js";
import type {
  CatalogueComponent,
  CatalogueNode,
  CatalogueReadModel,
} from "../src/catalogue/types.js";

type Mutable<Value> = Value extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : Value extends object
    ? { -readonly [Key in keyof Value]: Mutable<Value[Key]> }
    : Value;
type MutableCatalogue = Mutable<CatalogueReadModel>;

/** Build a valid fixture covering every route-scoping entry shape. */
export function scopedCatalogueFixture(): CatalogueReadModel {
  const value = JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as MutableCatalogue;
  addVariantScreen(value);
  addRemovedVariant(value.components[0]!);
  addRemovedComponent(value);
  addRemovedUseCase(value);
  const useCase = value.useCases[0]!;
  useCase.steps.push(structuredClone(useCase.steps[0]!));
  return readCatalogue(value);
}

function addVariantScreen(value: MutableCatalogue): void {
  const parent = value.screens[0]!;
  const variant = structuredClone(parent);
  variant.id = "home-empty";
  variant.route = "screens/home.variants/empty.html";
  variant.title = "Home, empty";
  variant.useCaseIds = [];
  variant.variantOf = parent.id;
  for (const view of variant.views) {
    const dark = view.colorScheme === "dark" ? ".dark" : "";
    view.fragmentPath = `static/screens/home.variants/empty.${view.viewport}${dark}.html`;
  }
  value.screens.push(variant);
  const node = findNode(value.tree.pages, parent.id);
  if (!node || node.kind !== "entry") throw new Error("Missing home node");
  node.children = [{ id: variant.id, kind: "entry" }];
}

function addRemovedVariant(component: Mutable<CatalogueComponent>): void {
  const variant = structuredClone(component.variants[0]!);
  variant.id = "retired";
  variant.title = "Retired";
  variant.comparison = {
    eligible: true,
    kind: "removed",
    status: "ready",
  };
  for (const view of variant.views) view.fragmentPath = null;
  component.variants.push(variant);
}

function addRemovedComponent(value: MutableCatalogue): void {
  const component = structuredClone(value.components[0]!);
  component.id = "removed-action";
  component.route = "components/removed-action.html";
  component.title = "Removed action";
  component.changes = { included: true, kind: "removed", status: "ready" };
  for (const variant of component.variants)
    for (const view of variant.views) view.fragmentPath = null;
  value.removedEntries.push({
    ancestors: [{ id: "product", title: "Product" }],
    entry: component,
    snapshotId: "d".repeat(64),
  });
}

function addRemovedUseCase(value: MutableCatalogue): void {
  const useCase = structuredClone(value.useCases[0]!);
  useCase.id = "removed-tour";
  useCase.route = "user-flows/removed-tour.html";
  useCase.title = "Removed tour";
  useCase.changes = { included: true, kind: "removed", status: "ready" };
  value.removedEntries.push({
    ancestors: [{ id: "product", title: "Product" }],
    entry: useCase,
    snapshotId: "e".repeat(64),
  });
}

function findNode(
  nodes: Mutable<CatalogueNode>[],
  id: string,
): Mutable<CatalogueNode> | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findNode(node.children ?? [], id);
    if (nested) return nested;
  }
  return undefined;
}
