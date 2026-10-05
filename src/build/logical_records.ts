import {
  entryRoute,
  documentRoute,
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
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
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
    const key = `${record.destination.path}#${fragment}`;
    if (checked.has(key)) continue;
    checked.add(key);
    const entry = byPath.get(record.destination.path);
    if (entry?.kind === "document") {
      for (const scheme of config.colorSchemes) {
        const route = documentRoute(entry.path, scheme);
        if (!anchors(route)?.has(fragment))
          throw new MoklyError(
            "build-invalid",
            `${record.sourceRoute} logical fragment ${fragment} for ${entry.path} is missing from document ${route}`,
          );
      }
      continue;
    }
    if (entry?.kind === "page") {
      const route = entryRoute(entry.path);
      if (!anchors(route)?.has(fragment))
        throw new MoklyError(
          "build-invalid",
          `${record.sourceRoute} logical fragment ${fragment} for ${entry.path} is missing from page ${route}`,
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
                  candidate.variantOf === entry.path,
              )
          : entry?.kind === "use-case" && entry.steps[0]
            ? byPath.get(entry.steps[0].screenPath)
            : undefined;
    if (screen?.kind !== "screen" && screen?.kind !== "component") continue;
    for (const viewport of VIEWPORTS) {
      for (const scheme of effectiveColorSchemes(screen, config.colorSchemes)) {
        const route = viewRoute(screen.path, viewport, scheme);
        if (!anchors(route)?.has(fragment)) {
          throw new MoklyError(
            "build-invalid",
            `${record.sourceRoute} logical fragment ${fragment} for ${record.destination.path} is missing from ${viewport} ${scheme} view ${route}`,
          );
        }
      }
    }
  }
}
