import { decodeProps } from "../components/codec.js";
import { validateControlledValues } from "../components/controls.js";
import { canonicalJson, invalidData } from "../components/data.js";
import { componentFragmentRoute } from "../components/paths.js";
import { validateProps } from "../components/props.js";
import { validateComponentViewRecord } from "../components/view_validation.js";
import { analyzeHierarchy } from "../registry/hierarchy.js";

import { projectTree } from "./tree.js";
import type {
  CatalogueCollection,
  CatalogueComponent,
  CatalogueReadModel,
  CatalogueRoutedEntry,
  CatalogueView,
} from "./types.js";
import { unique } from "./values.js";

/** Validate relationships after parsing all known fields, including both ownership sections. */
export function validateCatalogueReferences(model: CatalogueReadModel): void {
  require(model.identity.title === "Mokly", "catalogue title must be Mokly");
  const current: (CatalogueCollection | CatalogueRoutedEntry)[] = [
    ...model.collections,
    ...model.screens,
    ...model.pages,
    ...model.useCases,
    ...model.components,
  ];
  unique(current.map((entry) => entry.id));
  unique(
    current.flatMap((entry) =>
      entry.kind === "collection" ? [] : [entry.route],
    ),
  );
  const { hierarchy, issues } = analyzeHierarchy(current);
  require(issues.length === 0, "invalid collection forest");
  require(canonicalJson(model.tree) ===
    canonicalJson(
      projectTree(hierarchy),
    ), "tree must project the collection forest");
  const all = [...current, ...model.removedEntries.map(({ entry }) => entry)];
  unique(model.removedEntries.map(({ entry }) => entry.route));
  const components = new Map(
    all
      .filter((entry) => entry.kind === "component")
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
        (item) =>
          item.kind !== "collection" &&
          entry.kind !== "collection" &&
          item.route === entry.route,
      ), "current routes take precedence");
    }
    if (entry.kind === "collection")
      require(entry.tags.length === 0, "collections have no tags");
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
      require(entry.variants.length > 0, "component needs variants");
      unique(entry.slots);
      unique(entry.variants.map((variant) => variant.id));
      for (const variant of entry.variants) {
        if (variant.comparison.status === "ready")
          require(variant.comparison.eligible ===
            (variant.comparison.kind === "changed" ||
              variant.comparison.kind ===
                "removed"), "invalid variant comparison eligibility");
        const historical =
          removed ||
          (variant.comparison.status === "ready" &&
            variant.comparison.kind === "removed");
        unique(variant.suppliedSlots);
        if (!historical) {
          require(variant.suppliedSlots.every((slot) =>
            entry.slots.includes(slot),
          ), "unknown supplied slot");
          validateControlledValues(
            entry.controls,
            validateProps(entry.propSchema, decodeProps(variant.props)),
            entry.id,
          );
        }
        validateViews(entry, variant.views, components, historical, variant.id);
      }
    }
  }
  for (const { ancestors } of model.removedEntries)
    unique(ancestors.map((ancestor) => ancestor.id));
  if (model.changesStatus !== "ready")
    require(model.comparisonUrl === null &&
      model.removedEntries.length ===
        0, "incomplete evidence cannot pin comparisons or removals");
}

function validateViews(
  entry: Extract<CatalogueRoutedEntry, { kind: "screen" | "component" }>,
  views: readonly CatalogueView[],
  components: ReadonlyMap<string, CatalogueComponent>,
  historical: boolean,
  variantId?: string,
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
    const stem = entry.route.slice(0, -5);
    const expected = `static/${variantId ? componentFragmentRoute(entry.route, variantId, view.viewport, view.colorScheme) : `${stem}.${view.viewport}${view.colorScheme === "dark" ? ".dark" : ""}.html`}`;
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
        entry.kind === "component" ? entry.id : undefined,
        historical,
      );
  }
}

function require(condition: boolean, message: string): void {
  if (!condition) invalidData("$catalogue", message);
}
