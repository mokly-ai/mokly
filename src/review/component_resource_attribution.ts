import type { ComponentViewRecord } from "@mokly/viewer";
import type {
  ChangedEntry,
  ComponentReview,
  EntryChangeReason,
  DependencyReason,
} from "@mokly/viewer/data";
import { isStylesheetPath } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";

import { uniqueReasons } from "./component_metadata.js";

/** Retained actual-invocation evidence can affect an owner without a saved variant. */
export interface OwnedResourceReason {
  componentId: string;
  reason: DependencyReason;
}

export function ownedResourceReasons(
  reasons: readonly DependencyReason[],
  prefix: string,
  before?: ComponentViewRecord,
  after?: ComponentViewRecord,
  root?: string,
): OwnedResourceReason[] {
  const usages = [before, after].filter((usage) => usage !== undefined);
  const present = new Set([
    ...(root ? [root] : []),
    ...usages.flatMap((usage) =>
      usage.instances.map((instance) => instance.componentId),
    ),
  ]);
  return reasons.flatMap((reason) => {
    if (isStylesheetPath(reason.path) && !reason.analysis) return [];
    const publicPath = prefix
      ? reason.path.slice(prefix.length + 1)
      : reason.path;
    const owners = new Set([
      ...usages.flatMap((usage) =>
        usage.resources.flatMap((resource) =>
          resource.path === publicPath ? resource.componentIds : [],
        ),
      ),
    ]);
    return [...owners]
      .filter((componentId) => present.has(componentId))
      .map((componentId) => ({ componentId, reason }));
  });
}

/** Derive impact only from retained rendered-resource reasons. */
export function resourceImpact(
  reasons: readonly EntryChangeReason[],
): string[] {
  return [
    ...new Set(
      reasons.flatMap((reason) =>
        reason.kind === "dependency" ? [reason.path] : [],
      ),
    ),
  ].sort();
}

export function propagateOwnedResources(
  evidence: readonly OwnedResourceReason[],
  impacting: Set<string>,
  components: readonly ComponentReview[],
  changes: ChangedEntry[],
): void {
  for (const { componentId, reason } of evidence) {
    const component = components.find((entry) => entry.id === componentId);
    if (!component)
      throw new MoklyError("review-invalid", "resource owner has no component");
    impacting.add(componentId);
    const existing = changes.find(
      (entry) =>
        entry.kind === "component" &&
        (entry.after ?? entry.before)?.id === componentId,
    );
    if (existing)
      existing.reasons = uniqueReasons([...existing.reasons, reason]);
    else
      changes.push({
        kind: "component",
        ...(component.before ? { before: component.before } : {}),
        ...(component.after ? { after: component.after } : {}),
        reasons: [reason],
      });
    component.sharedImpact = [
      ...new Set([...component.sharedImpact, reason.path]),
    ].sort();
  }
}
