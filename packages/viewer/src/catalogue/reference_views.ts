/** Validate stored usage, view axes and component variant values before branding. */

import { decodeProps } from "../components/codec.js";
import { validateControlledValues } from "../components/controls.js";
import { canonicalJson, invalidData } from "../components/data.js";
import { validateProps } from "../components/props.js";
import { validateComponentViewRecord } from "../components/view_validation.js";
import { VIEWPORTS } from "../registry/views.js";

import type { BranchPointLookup } from "./branch_point_types.js";
import type {
  ValidatedCatalogue,
  ValidatedRoutedEntry,
  ValidatedComponent,
  ValidatedVariant,
  ValidatedView,
} from "./reference_types.js";
import type { ShellCatalogueScreen } from "./scoped_types.js";
import type { CatalogueScreen } from "./types.js";
import { unique } from "./values.js";

export function validateViews(
  entry:
    CatalogueScreen<string> | ShellCatalogueScreen<string> | ValidatedVariant,
  views: readonly ValidatedView[],
  lookup: Pick<
    BranchPointLookup<
      ValidatedRoutedEntry,
      ValidatedCatalogue["removedEntries"][number]
    >,
    "usageComponent"
  >,
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
    if (view.usage.status === "ready") {
      const components = new Map(
        view.usage.instances.flatMap((instance) => {
          const component = lookup.usageComponent(
            instance.componentId,
            historical ? "before" : "after",
          )?.entry;
          return component?.kind === "component" && !("variantOf" in component)
            ? [[instance.componentId, component] as const]
            : [];
        }),
      );
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
}

export function validateComponentVariant(
  entry: ValidatedVariant,
  components: ReadonlyMap<string, ValidatedComponent>,
  current: readonly ValidatedRoutedEntry[],
  removed: boolean,
  lookup: Pick<
    BranchPointLookup<
      ValidatedRoutedEntry,
      ValidatedCatalogue["removedEntries"][number]
    >,
    "usageComponent"
  >,
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
  validateViews(entry, entry.views, lookup, removed);
}

function require(condition: boolean, message: string): void {
  if (!condition) invalidData("$catalogue", message);
}
