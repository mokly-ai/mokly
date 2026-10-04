import {
  entryRoute,
  effectiveColorSchemes,
  viewRoute,
  VIEWPORTS,
} from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import { isComponentVariantDefinition } from "../components/types.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";
import { extractHtmlReferences } from "../html_references.js";

import type { LogicalReferenceRecord } from "./logical_record_types.js";

/** Validate every logical fragment against all destination artifacts. */
export function validateLogicalFragments(
  outputs: ReadonlyMap<string, string>,
  records: readonly LogicalReferenceRecord[],
  entries: readonly ResolvedRegistryEntry[],
  config: ResolvedConfig,
  anchorsFor?: (route: string) => ReadonlySet<string> | undefined,
): void {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const anchorIndex = new Map<string, ReadonlySet<string>>();
  const anchors =
    anchorsFor ??
    ((route: string) => {
      if (!anchorIndex.has(route)) {
        const content = outputs.get(route);
        if (content !== undefined)
          anchorIndex.set(route, extractHtmlReferences(content).anchors);
      }
      return anchorIndex.get(route);
    });
  const checked = new Set<string>();
  for (const record of records) {
    const fragment = record.destination.fragment;
    if (!fragment) continue;
    const key = `${record.destination.id}#${fragment}`;
    if (checked.has(key)) continue;
    checked.add(key);
    const entry = byId.get(record.destination.id);
    if (entry?.kind === "page") {
      const route = entryRoute("page", entry.id);
      if (!anchors(route)?.has(fragment))
        throw new MoklyError(
          "build-invalid",
          `${record.sourceRoute} logical fragment ${fragment} for ${entry.id} is missing from page ${route}`,
        );
      continue;
    }
    const screen =
      entry?.kind === "screen"
        ? entry
        : entry?.kind === "component"
          ? isComponentVariantDefinition(entry)
            ? entry
            : entries.find(
                (candidate) =>
                  candidate.kind === "component" &&
                  isComponentVariantDefinition(candidate) &&
                  candidate.variantOf === entry.id,
              )
          : entry?.kind === "use-case" && entry.steps[0]
            ? byId.get(entry.steps[0].screenId)
            : undefined;
    if (screen?.kind !== "screen" && screen?.kind !== "component") continue;
    for (const viewport of VIEWPORTS) {
      for (const scheme of effectiveColorSchemes(screen, config.colorSchemes)) {
        const route = viewRoute(screen.kind, screen.id, viewport, scheme);
        if (!anchors(route)?.has(fragment)) {
          throw new MoklyError(
            "build-invalid",
            `${record.sourceRoute} logical fragment ${fragment} for ${record.destination.id} is missing from ${viewport} ${scheme} view ${route}`,
          );
        }
      }
    }
  }
}
