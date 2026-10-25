/** Relationship rules of the catalogue index v7, checked after every field. */

import { canonicalJson, invalidData } from "../components/data.js";
import { firstPathCaseCollision } from "../navigation/logical.js";
import { VIEWPORTS } from "../registry/views.js";

import { validateCatalogueTree } from "./tree_validation.js";
import type {
  CatalogueComponent,
  CatalogueDocument,
  CatalogueReadModel,
  CatalogueRecord,
  CatalogueScreen,
} from "./types.js";
import { unique } from "./values.js";

/** Validate the index relationships, including current and removed records. */
export function validateCatalogueReferences(model: CatalogueReadModel): void {
  require(model.identity.title === "Mokly", "catalogue title must be Mokly");
  const current: CatalogueRecord[] = [
    ...model.screens,
    ...model.pages,
    ...model.documents,
    ...model.useCases,
    ...model.components,
  ];
  unique(current.map((entry) => entry.path.toLowerCase()));
  const collision = firstPathCaseCollision(current.map((entry) => entry.path));
  if (collision)
    invalidData(
      "$catalogue",
      `paths ${collision[0]} and ${collision[1]} differ only by letter case`,
    );
  validateCatalogueTree(model.tree, current);
  const historical = model.removedEntries.map(({ entry }) => entry);
  const currentPaths = new Set(
    current.map((entry) => entry.path.toLowerCase()),
  );
  require(historical.every(
    (entry) => !currentPaths.has(entry.path.toLowerCase()),
  ), "current and removed entries cannot share a path");
  validateMoves(current, historical);
  unique(historical.map((entry) => entry.path.toLowerCase()));
  unique(
    model.removedEntries.flatMap(({ snapshotId }) =>
      snapshotId ? [snapshotId] : [],
    ),
  );
  const documentPaths = new Set(model.documents.map((entry) => entry.path));
  for (const entry of [...current, ...historical]) {
    const removed = !current.includes(entry);
    validateEntry(model, entry, removed, documentPaths);
  }
  for (const { entry, preview } of model.removedEntries)
    if (preview) {
      require(Boolean(model.comparisonUrl), "preview requires comparison URL");
      require(preview.kind === entry.kind, "preview kind must match entry");
    }
  if (model.changesStatus !== "ready")
    require(model.comparisonUrl === null &&
      model.removedEntries.length ===
        0, "incomplete evidence cannot pin comparisons or removals");
}

function validateMoves(
  current: readonly CatalogueRecord[],
  historical: readonly CatalogueRecord[],
): void {
  const previousPaths = new Set<string>();
  const removedPaths = new Set(
    historical.map((entry) => entry.path.toLowerCase()),
  );
  for (const entry of current) {
    if (entry.previousPath === undefined) continue;
    const previous = entry.previousPath.toLowerCase();
    require(previous !==
      entry.path.toLowerCase(), "previousPath must name a different identity");
    require(entry.changes.status === "ready" &&
      entry.changes.included &&
      (entry.changes.kind === "changed" ||
        entry.changes.kind ===
          "unmodified"), "moved entry needs included changed or unmodified Changes");
    require(!previousPaths.has(previous), "previous paths must be unique");
    require(!removedPaths.has(
      previous,
    ), "paired previous path cannot be removed");
    previousPaths.add(previous);
  }
}

function validateEntry(
  model: CatalogueReadModel,
  entry: CatalogueRecord,
  removed: boolean,
  documentPaths: ReadonlySet<string>,
): void {
  if ("variantOf" in entry && entry.variantOf !== undefined)
    require(entry.path.split("/").slice(0, -1).join("/") ===
      entry.variantOf, "variant path must be parent path plus one segment");
  unique(entry.tags);
  for (const link of entry.details.relatedDocs)
    if (link.startsWith("mock:"))
      require(documentPaths.has(
        link.slice(5),
      ), "related document must name a current document");
  require(entry.changes.status ===
    model.changesStatus, "entry status must match the index Changes status");
  if (removed)
    require(entry.changes.status === "ready" &&
      entry.changes.kind === "removed" &&
      entry.changes.included, "removed entry needs removed Changes");
  else if (entry.changes.status === "ready")
    require(entry.changes.kind !==
      "removed", "current entry cannot have removed Changes");
  if (entry.kind === "use-case" && !removed) validateUseCase(model, entry);
  if (entry.kind === "screen") validateScreen(model, entry, removed);
  if (entry.kind === "component") validateComponent(model, entry, removed);
  if (entry.kind === "document") validateDocument(entry);
}

function validateUseCase(
  model: CatalogueReadModel,
  entry: Extract<CatalogueRecord, { kind: "use-case" }>,
): void {
  require(entry.steps.length > 0, "use case needs steps");
  for (const step of entry.steps) {
    const screen = model.screens.find(
      (candidate) => candidate.path === step.screenPath,
    );
    require(Boolean(
      screen?.useCasePaths.includes(entry.path),
    ), "invalid use-case membership");
  }
}

function validateScreen(
  model: CatalogueReadModel,
  entry: CatalogueScreen,
  removed: boolean,
): void {
  unique(entry.useCasePaths);
  if (entry.variantOf !== undefined && !removed) {
    const parent = model.screens.find(
      (screen) => screen.path === entry.variantOf,
    );
    require(parent !== undefined, "variant parent screen must exist");
    require(parent?.variantOf ===
      undefined, "variant parent cannot be a variant");
  }
  if (!removed)
    for (const path of entry.useCasePaths)
      require(Boolean(
        model.useCases
          .find((flow) => flow.path === path)
          ?.steps.some((step) => step.screenPath === entry.path),
      ), "invalid screen membership");
  validateViews(entry, removed);
}

function validateComponent(
  model: CatalogueReadModel,
  entry: CatalogueComponent,
  removed: boolean,
): void {
  unique(entry.slots);
  unique(entry.suppliedSlots);
  if (entry.comparison.status === "ready")
    require(entry.comparison.eligible ===
      (entry.comparison.kind === "changed" ||
        entry.comparison.kind ===
          "removed"), "invalid component comparison eligibility");
  if (entry.variantOf === undefined) {
    require(entry.suppliedSlots.length ===
      0, "component parent supplies no variant slots");
  } else if (!removed) {
    require(!(
      entry.comparison.status === "ready" && entry.comparison.kind === "removed"
    ), "current variant cannot be historical");
    const parent = model.components.find(
      (candidate) => candidate.path === entry.variantOf,
    );
    require(parent !== undefined &&
      parent.variantOf === undefined, "variant parent component must exist");
    require(entry.suppliedSlots.every((slot) =>
      parent?.slots.includes(slot),
    ), "unknown supplied slot");
  }
  validateViews(entry, removed);
}

function validateViews(
  entry: CatalogueScreen | CatalogueComponent,
  removed: boolean,
): void {
  require(['["light"]', '["light","dark"]'].includes(
    canonicalJson(entry.colorSchemes),
  ), "invalid scheme set");
  const axes = VIEWPORTS.flatMap((viewport) =>
    entry.colorSchemes.map((scheme) => `${viewport}/${scheme}`),
  );
  const views = entry.views.map(
    (view) => `${view.viewport}/${view.colorScheme}`,
  );
  if (!removed)
    require(canonicalJson(views) ===
      canonicalJson(axes), "views must match axes");
  unique(views);
  for (const view of entry.views)
    if (view.comparison.status === "ready")
      require(view.comparison.eligible ===
        (view.comparison.kind === "changed" ||
          (entry.kind === "component" &&
            view.comparison.kind ===
              "removed")), "invalid comparison eligibility");
}

function validateDocument(entry: CatalogueDocument): void {
  require(['["light"]', '["light","dark"]'].includes(
    canonicalJson(entry.colorSchemes),
  ), "invalid scheme set");
  require(canonicalJson(entry.documentKeys.map((key) => key.colorScheme)) ===
    canonicalJson(entry.colorSchemes), "document keys must follow its schemes");
}

function require(condition: boolean, message: string): void {
  if (!condition) invalidData("$catalogue", message);
}
