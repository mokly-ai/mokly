import type { ComponentViewRecord } from "@mokly/viewer";
import type {
  ChangedEntry,
  ComponentReview,
  EntryChangeReason,
  DependencyReason,
  ViewReview,
} from "@mokly/viewer/data";
import { isStylesheetPath } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";

import {
  uniqueReasons,
  type ComponentDependencyPolicy,
  type RoutedEntry,
} from "./component_metadata.js";

/** Retained actual-invocation evidence can affect an owner without a saved variant. */
export interface OwnedCssReason {
  componentId: string;
  reason: DependencyReason;
}

export function ownedCssReasons(
  reasons: readonly DependencyReason[],
  policy: ComponentDependencyPolicy,
  prefix: string,
  before?: ComponentViewRecord,
  after?: ComponentViewRecord,
  root?: string,
): OwnedCssReason[] {
  const usages = [before, after].filter((usage) => usage !== undefined);
  const present = new Set([
    ...(root ? [root] : []),
    ...usages.flatMap((usage) =>
      usage.instances.map((instance) => instance.componentId),
    ),
  ]);
  return reasons.flatMap((reason) => {
    if (!reason.analysis) return [];
    const publicPath = prefix
      ? reason.path.slice(prefix.length + 1)
      : reason.path;
    const owners = new Set([
      ...policy.owners(reason.path),
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

/** Exact caller declarations remain independent, but cannot bypass CSS exclusion. */
export function exactScreenCssReasons(
  before: RoutedEntry | undefined,
  after: RoutedEntry | undefined,
  views: readonly ViewReview[],
): DependencyReason[] {
  return views.flatMap((view) =>
    (view.reasons ?? []).filter(
      (reason) =>
        reason.analysis &&
        [before, after].some(
          (entry) =>
            entry?.kind === "screen" &&
            entry.declaredDependencies?.includes(reason.path),
        ),
    ),
  );
}

/** Preserve non-CSS diagnostics and derive stylesheet impact from retained evidence. */
export function resourceImpact(
  shared: readonly string[],
  reasons: readonly EntryChangeReason[],
): string[] {
  return [
    ...new Set([
      ...shared.filter((path) => !isStylesheetPath(path)),
      ...reasons.flatMap((reason) =>
        reason.kind === "dependency" ? [reason.path] : [],
      ),
    ]),
  ].sort();
}

export function propagateOwnedCss(
  evidence: readonly OwnedCssReason[],
  impacting: Set<string>,
  components: readonly ComponentReview[],
  changes: ChangedEntry[],
): void {
  for (const { componentId, reason } of evidence) {
    const component = components.find((entry) => entry.id === componentId);
    if (!component)
      throw new MoklyError("review-invalid", "CSS owner has no component");
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
