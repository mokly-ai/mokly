import type { CatalogueView } from "@mokly/viewer";
import type { ManifestEntry, ManifestScreen } from "@mokly/viewer/data";
import {
  fragmentViews,
  isManifestComponentVariant,
  readInstance,
  readRange,
  readSlot,
  lexical,
  publicPath,
} from "@mokly/viewer/data";

import { comparisonSelection } from "./changes.js";
import type { CatalogueProjectionInput } from "./projection_input.js";

export function projectViews(
  input: CatalogueProjectionInput,
  retainedComponents: ReadonlySet<string>,
  entry: ManifestScreen | Extract<ManifestEntry, { kind: "component" }>,
  removed: boolean,
): CatalogueView[] {
  if (entry.kind === "component" && !isManifestComponentVariant(entry))
    return [];
  const result = input.comparison ?? input.evidence?.result;
  const reviewViews =
    entry.kind === "screen"
      ? (result?.screens.find((item) => item.route === entry.route)?.views ??
        input.evidence?.screenViews?.find((item) => item.route === entry.route)
          ?.views)
      : result?.schemaVersion === 3 && isManifestComponentVariant(entry)
        ? result.components
            .find((item) => item.id === entry.variantOf)
            ?.variants.find((item) => item.id === entry.id)?.views
        : undefined;
  return fragmentViews(
    entry,
    entry.kind === "component" ? entry.id : undefined,
  ).map((view) => {
    const recordedUsage =
      (!removed ? input.usage?.get(view.path) : undefined) ?? view.usage;
    const usage =
      removed &&
      recordedUsage?.instances.some(
        (instance) => !retainedComponents.has(instance.componentId),
      )
        ? undefined
        : recordedUsage;
    const live =
      !removed && input.catalogue.manifest.schemaVersion === "live-index-1";
    const provenEmpty =
      !live &&
      !removed &&
      !input.catalogue.manifest.entries.some(
        (item) => item.kind === "component",
      );
    const state = removed
      ? "removed"
      : reviewViews?.find(
          (item) =>
            item.viewport === view.viewport &&
            item.colorScheme === view.colorScheme,
        )?.state;
    return {
      viewport: view.viewport,
      colorScheme: view.colorScheme,
      fragmentPath: removed ? null : publicPath(`static/${view.path}`),
      usage: usage
        ? {
            status: "ready",
            instances: usage.instances
              .map(readInstance)
              .sort((a, b) => lexical(a.key, b.key)),
            slots: usage.slots
              .map(readSlot)
              .sort((a, b) => lexical(a.key, b.key)),
            ranges: usage.ranges
              .map(readRange)
              .sort((a, b) => Number(a.id.slice(2)) - Number(b.id.slice(2))),
          }
        : provenEmpty
          ? { status: "ready", instances: [], slots: [], ranges: [] }
          : {
              status:
                live && input.changesStatus !== "unavailable"
                  ? "pending"
                  : "unavailable",
            },
      comparison: comparisonSelection(input, state, entry.kind === "component"),
    };
  });
}
