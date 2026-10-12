import type { CatalogueView } from "@mokly/viewer";
import type { ManifestEntry, ManifestScreen } from "@mokly/viewer/data";
import {
  generatedViews,
  isManifestComponentVariant,
  readInstance,
  readRange,
  readSlot,
  lexical,
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
      ? (result?.screens.find((item) => item.path === entry.path)?.views ??
        input.evidence?.screenViews?.find((item) => item.path === entry.path)
          ?.views)
      : result && isManifestComponentVariant(entry)
        ? result.components
            .find((item) => item.path === entry.variantOf)
            ?.variants.find((item) => item.path === entry.path)?.views
        : undefined;
  const resourceViews =
    entry.kind === "screen"
      ? (input.evidence?.screenEvidence?.find(
          (item) => item.path === entry.path,
        )?.views ??
        result?.screens.find((item) => item.path === entry.path)?.views)
      : reviewViews;
  return generatedViews(entry).map((view) => {
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
      !removed && input.catalogue.manifest.schemaVersion === "live-index-2";
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
    const evidence =
      input.changesStatus === "ready"
        ? resourceViews?.find(
            (item) =>
              item.viewport === view.viewport &&
              item.colorScheme === view.colorScheme,
          )
        : undefined;
    return {
      ...(evidence &&
      ("reasons" in evidence ||
        "excludedResources" in evidence ||
        "inlineStyles" in evidence)
        ? {
            resourceEvidence: {
              ...("inlineStyles" in evidence && evidence.inlineStyles
                ? { inlineStyles: evidence.inlineStyles }
                : {}),
              ...("reasons" in evidence && evidence.reasons?.length
                ? { reasons: evidence.reasons }
                : {}),
              ...("excludedResources" in evidence &&
              evidence.excludedResources?.length
                ? { excludedResources: evidence.excludedResources }
                : {}),
            },
          }
        : {}),
      viewport: view.viewport,
      colorScheme: view.colorScheme,
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
