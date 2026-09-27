import { decodeProps } from "../components/codec.js";
import { validateControlledValues } from "../components/controls.js";
import { canonicalJson, invalidData } from "../components/data.js";
import { validateProps } from "../components/props.js";
import { validateComponentViewRecord } from "../components/view_validation.js";
import { viewRoute } from "../data/routes.js";
import { analyzeHierarchy } from "../registry/hierarchy.js";

import { projectTree } from "./tree.js";
import type {
  CatalogueComponent,
  CatalogueComponentVariant,
  CatalogueReadModel,
  CatalogueRoutedEntry,
  CatalogueScreen,
  CatalogueView,
} from "./types.js";
import { unique } from "./values.js";

/** Validate relationships after parsing all known fields, including both ownership sections. */
export function validateCatalogueReferences(model: CatalogueReadModel): void {
  require(model.identity.title === "Mokly", "catalogue title must be Mokly");
  const current: CatalogueRoutedEntry[] = [
    ...model.screens,
    ...model.pages,
    ...model.useCases,
    ...model.components,
  ];
  unique(current.map((entry) => entry.id));
  unique(current.map((entry) => entry.route));
  const { hierarchy, issues } = analyzeHierarchy(current);
  require(issues.length === 0, "invalid navigation paths");
  require(canonicalJson(model.tree) ===
    canonicalJson(
      projectTree(hierarchy),
    ), "tree must project the navigation paths");
  const historical = model.removedEntries.map(({ entry }) => entry);
  const all = [...current, ...historical];
  unique(model.removedEntries.map(({ entry }) => entry.route));
  unique(
    model.removedEntries.flatMap(({ snapshotId }) =>
      snapshotId ? [snapshotId] : [],
    ),
  );
  const components = new Map(
    all
      .filter(
        (entry): entry is CatalogueComponent =>
          entry.kind === "component" && !("variantOf" in entry),
      )
      .map((entry) => [entry.id, entry]),
  );
  for (const entry of all) {
    unique(entry.tags);
    const removed = !current.includes(entry);
    require(entry.changes.status ===
      model.changesStatus, "entry status must match snapshot");
    if (removed) {
      require(entry.changes.status === "ready" &&
        entry.changes.kind === "removed" &&
        entry.changes.included, "removed entry needs removed Changes");
      require(!current.some(
        (item) => item.route === entry.route,
      ), "current routes take precedence");
    }
    if (entry.kind === "page")
      require(removed
        ? entry.documentPath === null
        : entry.documentPath ===
            `static/${entry.route}`, "page path must match current route");
    if (entry.kind === "use-case" && !removed) {
      require(entry.steps.length > 0, "use case needs steps");
      for (const step of entry.steps) {
        const screen = model.screens.find(
          (screen) => screen.id === step.screenId,
        );
        require(Boolean(
          screen?.useCaseIds.includes(entry.id),
        ), "invalid use-case membership");
      }
    }
    if (entry.kind === "screen") {
      unique(entry.useCaseIds);
      if (entry.variantOf !== undefined && !removed) {
        const parent = model.screens.find(
          (screen) => screen.id === entry.variantOf,
        );
        const parentExists = parent !== undefined;
        require(parentExists, "variant parent screen must exist");
        const parentIsNotVariant =
          parent !== undefined && parent.variantOf === undefined;
        require(parentIsNotVariant, "variant parent cannot be a variant");
        require(canonicalJson(entry.navPath) ===
          canonicalJson(parent?.navPath), "variant path must match parent");
      }
      if (!removed)
        for (const id of entry.useCaseIds)
          require(Boolean(
            model.useCases
              .find((flow) => flow.id === id)
              ?.steps.some((step) => step.screenId === entry.id),
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
            candidate.variantOf === entry.id,
        ), "component needs variants");
      }
    }
  }
  for (const { entry, preview } of model.removedEntries) {
    if (preview) {
      require(Boolean(model.comparisonUrl), "preview requires comparison URL");
      require((preview.kind === "screen" && entry.kind === "screen") ||
        (preview.kind === "page" &&
          entry.kind === "page"), "preview kind must match removed entry");
      if (preview.kind === "page") {
        const generation = model.comparisonUrl!.slice(0, -"review.json".length);
        require(preview.path ===
          `${generation}pages/${entry.route}.json`, "page preview must match comparison generation and route");
      }
    }
  }
  if (model.changesStatus !== "ready")
    require(model.comparisonUrl === null &&
      model.removedEntries.length ===
        0, "incomplete evidence cannot pin comparisons or removals");
}

function validateViews(
  entry: CatalogueScreen | CatalogueComponentVariant,
  views: readonly CatalogueView[],
  components: ReadonlyMap<string, CatalogueComponent>,
  historical: boolean,
): void {
  require(canonicalJson(entry.viewports) ===
    '["mobile","desktop"]', "invalid viewport set");
  require(['["light"]', '["light","dark"]'].includes(
    canonicalJson(entry.colorSchemes),
  ), "invalid scheme set");
  const axes = entry.viewports.flatMap((viewport) =>
    entry.colorSchemes.map((scheme) => `${viewport}/${scheme}`),
  );
  if (!historical)
    require(canonicalJson(
      views.map((view) => `${view.viewport}/${view.colorScheme}`),
    ) === canonicalJson(axes), "views must match axes");
  unique(views.map((view) => `${view.viewport}/${view.colorScheme}`));
  for (const view of views) {
    const expected = `static/${viewRoute(entry.kind, entry.id, view.viewport, view.colorScheme)}`;
    require(historical
      ? view.fragmentPath === null
      : view.fragmentPath ===
          expected, "view path must match current fragment");
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
        entry.id,
        entry.kind === "component" ? entry.variantOf : undefined,
        historical,
      );
  }
}

function validateComponentVariant(
  entry: CatalogueComponentVariant,
  components: ReadonlyMap<string, CatalogueComponent>,
  current: readonly CatalogueRoutedEntry[],
  removed: boolean,
): void {
  if (entry.comparison.status === "ready")
    require(entry.comparison.eligible ===
      (entry.comparison.kind === "changed" ||
        entry.comparison.kind ===
          "removed"), "invalid variant comparison eligibility");
  const historical =
    removed ||
    (entry.comparison.status === "ready" &&
      entry.comparison.kind === "removed");
  const parent = components.get(entry.variantOf);
  if (!removed) {
    require(current.includes(
      parent as CatalogueRoutedEntry,
    ), "variant parent component must exist");
    require(canonicalJson(entry.navPath) ===
      canonicalJson(parent?.navPath), "variant path must match parent");
  }
  unique(entry.suppliedSlots);
  if (!historical && parent) {
    require(entry.suppliedSlots.every((slot) =>
      parent.slots.includes(slot),
    ), "unknown supplied slot");
    validateControlledValues(
      parent.controls,
      validateProps(parent.propSchema, decodeProps(entry.props)),
      entry.id,
    );
  }
  validateViews(entry, entry.views, components, historical);
}

function require(condition: boolean, message: string): void {
  if (!condition) invalidData("$catalogue", message);
}
