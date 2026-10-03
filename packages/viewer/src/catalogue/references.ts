import { decodeProps } from "../components/codec.js";
import { validateControlledValues } from "../components/controls.js";
import { canonicalJson, invalidData } from "../components/data.js";
import { validateProps } from "../components/props.js";
import { validateComponentViewRecord } from "../components/view_validation.js";
import { firstPathCaseCollision } from "../navigation/logical.js";
import { VIEWPORTS } from "../registry/views.js";

import type {
  ShellCatalogueComponent,
  ShellCatalogueReadModel,
  ShellCatalogueRoutedEntry,
  ShellCatalogueScreen,
  ShellCatalogueVariant,
  ShellCatalogueView,
} from "./scoped_types.js";
import { validateCatalogueTree } from "./tree_validation.js";
import type {
  CatalogueComponent,
  CatalogueComponentVariant,
  CatalogueReadModel,
  CatalogueRecord,
  CatalogueScreen,
  CatalogueView,
} from "./types.js";
import { unique } from "./values.js";

type ValidatedCatalogue = CatalogueReadModel | ShellCatalogueReadModel;
type ValidatedRoutedEntry = CatalogueRecord | ShellCatalogueRoutedEntry;
type ValidatedComponent = CatalogueComponent | ShellCatalogueComponent;
type ValidatedVariant = CatalogueComponentVariant | ShellCatalogueVariant;
type ValidatedView = CatalogueView | ShellCatalogueView;

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
  unique(model.removedEntries.map(({ entry }) => entry.path.toLowerCase()));
  unique(
    model.removedEntries.flatMap(({ snapshotId }) =>
      snapshotId ? [snapshotId] : [],
    ),
  );
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
      validateViews(entry, entry.views, components, removed);
    }
    if (entry.kind === "component") {
      if ("variantOf" in entry) {
        validateComponentVariant(entry, components, current, removed);
      } else {
        unique(entry.slots);
        const cohort = removed ? historical : current;
        require(cohort.some(
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

function validateViews(
  entry: CatalogueScreen | ShellCatalogueScreen | ValidatedVariant,
  views: readonly ValidatedView[],
  components: ReadonlyMap<string, ValidatedComponent>,
  historical: boolean,
): void {
  require(['["light"]', '["light","dark"]'].includes(
    canonicalJson(entry.colorSchemes),
  ), "invalid scheme set");
  const axes = VIEWPORTS.flatMap((viewport) =>
    entry.colorSchemes.map((scheme) => `${viewport}/${scheme}`),
  );
  if (!historical)
    require(canonicalJson(
      views.map((view) => `${view.viewport}/${view.colorScheme}`),
    ) === canonicalJson(axes), "views must match axes");
  unique(views.map((view) => `${view.viewport}/${view.colorScheme}`));
  for (const view of views) {
    if (view.comparison.status === "ready")
      require(view.comparison.eligible ===
        (view.comparison.kind === "changed" ||
          (entry.kind === "component" &&
            view.comparison.kind ===
              "removed")), "invalid comparison eligibility");
    if (view.usage.status === "ready")
      validateComponentViewRecord(
        {
          viewport: view.viewport,
          colorScheme: view.colorScheme,
          instances: view.usage.instances,
          slots: view.usage.slots,
          ranges: view.usage.ranges,
          styles: [],
          resources: [],
        },
        components,
        entry.path,
        entry.kind === "component" ? entry.variantOf : undefined,
        historical,
      );
  }
}

function validateComponentVariant(
  entry: ValidatedVariant,
  components: ReadonlyMap<string, ValidatedComponent>,
  current: readonly ValidatedRoutedEntry[],
  removed: boolean,
): void {
  if (entry.comparison.status === "ready")
    require(entry.comparison.eligible ===
      (entry.comparison.kind === "changed" ||
        entry.comparison.kind ===
          "removed"), "invalid variant comparison eligibility");
  if (!removed) {
    require(!(
      entry.comparison.status === "ready" && entry.comparison.kind === "removed"
    ), "current variant cannot be historical");
    require(!(
      entry.changes.status === "ready" && entry.changes.kind === "removed"
    ), "current variant cannot have removed Changes");
  }
  const parent = components.get(entry.variantOf);
  if (!removed) {
    require(current.includes(
      parent as ValidatedRoutedEntry,
    ), "variant parent component must exist");
  }
  unique(entry.suppliedSlots);
  if (!removed && parent) {
    require(entry.suppliedSlots.every((slot) =>
      parent.slots.includes(slot),
    ), "unknown supplied slot");
    validateControlledValues(
      parent.controls,
      validateProps(parent.propSchema, decodeProps(entry.props)),
      entry.path,
    );
  }
  validateViews(entry, entry.views, components, removed);
}

function require(condition: boolean, message: string): void {
  if (!condition) invalidData("$catalogue", message);
}
