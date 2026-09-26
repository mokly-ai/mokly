import type { EntryChangeReason } from "@mokly/viewer/data";

import { entryPairKey, type RoutedEntry } from "./component_metadata.js";
import type { OwnedCssReason } from "./component_resource_attribution.js";
import type { DependencyReasonSources } from "./component_result_sources.js";

/** Paths added by the classifier's own dependency-reason sources. */
export class ComponentReasonSources implements DependencyReasonSources {
  readonly pathsByEntry = new Map<string, Set<string>>();

  record(entry: RoutedEntry, reasons: readonly EntryChangeReason[]): void {
    const key = entryPairKey(entry);
    const paths = this.pathsByEntry.get(key) ?? new Set<string>();
    for (const reason of reasons)
      if (reason.kind === "dependency") paths.add(reason.path);
    this.pathsByEntry.set(key, paths);
  }

  recordOwnedCss(
    evidence: readonly OwnedCssReason[],
    entries: readonly RoutedEntry[],
  ): void {
    const components = new Map(
      entries.flatMap((entry) =>
        entry.kind === "component" ? [[entry.id, entry] as const] : [],
      ),
    );
    for (const item of evidence) {
      const component = components.get(item.componentId);
      if (component) this.record(component, [item.reason]);
    }
  }
}
