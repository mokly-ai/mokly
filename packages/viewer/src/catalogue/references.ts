import { invalidData } from "../components/data.js";
import { firstPathCaseCollision } from "../navigation/logical.js";

import { branchPoints } from "./branch_point.js";
import type {
  ValidatedCatalogue,
  ValidatedRoutedEntry,
  ValidatedComponent,
} from "./reference_types.js";
import { validateViews, validateComponentVariant } from "./reference_views.js";
import { validateCatalogueTree } from "./tree_validation.js";
import { unique } from "./values.js";

/** Validate relationships after parsing all known fields, including both ownership sections. */
export function validateCatalogueReferences(model: ValidatedCatalogue): void {
  require(model.identity.title === "Mokly", "catalogue title must be Mokly");
  const current: ValidatedRoutedEntry[] = [
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
  const all = [...current, ...historical];
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
    require(!current.some(
      (candidate) =>
        candidate.kind === entry.kind &&
        candidate.path.toLowerCase() === previous,
    ), "previousPath cannot name a current entry of the same kind");
    previousPaths.add(previous);
  }
  unique(model.removedEntries.map(({ entry }) => entry.path.toLowerCase()));
  unique(
    model.removedEntries.flatMap(({ snapshotId }) =>
      snapshotId ? [snapshotId] : [],
    ),
  );
  const lookup = branchPoints<
    ValidatedRoutedEntry,
    ValidatedCatalogue["removedEntries"][number]
  >(model);
  const components = new Map(
    [...historical, ...current]
      .filter(
        (entry): entry is ValidatedComponent =>
          entry.kind === "component" && !("variantOf" in entry),
      )
      .map((entry) => [entry.path, entry]),
  );
  const documentPaths = new Set(model.documents.map((entry) => entry.path));
  for (const entry of all) {
    if ("variantOf" in entry && entry.variantOf !== undefined)
      require(entry.path.split("/").slice(0, -1).join("/") ===
        entry.variantOf, "variant path must be parent path plus one segment");
    unique(entry.tags);
    for (const link of entry.details.relatedDocs)
      if (link.startsWith("mock:"))
        require(documentPaths.has(
          link.slice(5),
        ), "related document must name a current document");
    const removed = !current.includes(entry);
    require(entry.changes.status ===
      model.changesStatus, "entry status must match snapshot");
    if (!removed && entry.changes.status === "ready")
      require(entry.changes.kind !==
        "removed", "current entry cannot have removed Changes");
    if (removed) {
      require(entry.changes.status === "ready" &&
        entry.changes.kind === "removed" &&
        entry.changes.included, "removed entry needs removed Changes");
    }
    if (entry.kind === "use-case" && !removed) {
      require(entry.steps.length > 0, "use case needs steps");
      for (const step of entry.steps) {
        const screen = model.screens.find(
          (screen) => screen.path === step.screenPath,
        );
        require(Boolean(
          screen?.useCasePaths.includes(entry.path),
        ), "invalid use-case membership");
      }
    }
    if (entry.kind === "screen") {
      unique(entry.useCasePaths);
      if (entry.variantOf !== undefined && !removed) {
        const parent = model.screens.find(
          (screen) => screen.path === entry.variantOf,
        );
        const parentExists = parent !== undefined;
        require(parentExists, "variant parent screen must exist");
        const parentIsNotVariant =
          parent !== undefined && parent.variantOf === undefined;
        require(parentIsNotVariant, "variant parent cannot be a variant");
      }
      if (!removed)
        for (const id of entry.useCasePaths)
          require(Boolean(
            model.useCases
              .find((flow) => flow.path === id)
              ?.steps.some((step) => step.screenPath === entry.path),
          ), "invalid screen membership");
      validateViews(entry, entry.views, lookup, removed);
    }
    if (entry.kind === "component") {
      if ("variantOf" in entry) {
        validateComponentVariant(entry, components, current, removed, lookup);
      } else {
        unique(entry.slots);
        if (!removed)
          require(current.some(
            (candidate) =>
              candidate.kind === "component" &&
              "variantOf" in candidate &&
              candidate.variantOf === entry.path,
          ), "component needs variants");
      }
    }
  }
  for (const { entry, preview } of model.removedEntries) {
    if (preview) {
      require(Boolean(model.comparisonUrl), "preview requires comparison URL");
      require((preview.kind === "screen" && entry.kind === "screen") ||
        (preview.kind === "page" && entry.kind === "page") ||
        (preview.kind === "document" &&
          entry.kind === "document"), "preview kind must match removed entry");
      if (preview.kind === "page") {
        require(entry.kind === "page", "page preview needs a page");
      }
    }
  }
  if (model.changesStatus !== "ready")
    require(model.comparisonUrl === null &&
      model.removedEntries.length ===
        0, "incomplete evidence cannot pin comparisons or removals");
}

function require(condition: boolean, message: string): void {
  if (!condition) invalidData("$catalogue", message);
}
