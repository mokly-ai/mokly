import type { EntryChangeReason, DependencyReason } from "@mokly/viewer/data";

import {
  entryPairKey,
  uniqueReasons,
  type ReviewEntry,
} from "./component_metadata.js";
import type { OwnedResourceReason } from "./component_resource_attribution.js";
import type { DependencyReasonSources } from "./component_result_sources.js";
import type { CssAttribution } from "./css/attribution.js";

/** Paths added by the classifier's own dependency-reason sources. */
export class ComponentReasonSources implements DependencyReasonSources {
  readonly pathsByEntry = new Map<string, Set<string>>();
  readonly reasonsByEntry = new Map<string, readonly DependencyReason[]>();

  constructor(readonly cssProof?: CssAttribution) {}

  record(entry: ReviewEntry, reasons: readonly EntryChangeReason[]): void {
    const key = entryPairKey(entry);
    const paths = this.pathsByEntry.get(key) ?? new Set<string>();
    for (const reason of reasons)
      if (reason.kind === "dependency") paths.add(reason.path);
    this.pathsByEntry.set(key, paths);
    this.reasonsByEntry.set(
      key,
      structuredClone(
        uniqueReasons([
          ...(this.reasonsByEntry.get(key) ?? []),
          ...reasons.filter(
            (reason): reason is DependencyReason =>
              reason.kind === "dependency",
          ),
        ]) as DependencyReason[],
      ),
    );
  }

  recordOwnedResources(
    evidence: readonly OwnedResourceReason[],
    entries: readonly ReviewEntry[],
  ): void {
    const components = new Map(
      entries.flatMap((entry) =>
        entry.kind === "component" ? [[entry.path, entry] as const] : [],
      ),
    );
    for (const item of evidence) {
      const component = components.get(item.componentId);
      if (component) this.record(component, [item.reason]);
    }
  }
}
