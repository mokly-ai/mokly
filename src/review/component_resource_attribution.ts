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

import type { InlineResourceOwners } from "./component_inline_resources.js";
import {
  uniqueReasons,
  type ComponentDependencyPolicy,
  type ReviewEntry,
} from "./component_metadata.js";

/** Retained actual-invocation evidence can affect an owner without a saved variant. */
export interface OwnedResourceReason {
  componentId: string;
  reason: DependencyReason;
}

export function ownedResourceReasons(
  reasons: readonly DependencyReason[],
  policy: ComponentDependencyPolicy,
  inlineOwners: InlineResourceOwners,
  before?: ComponentViewRecord,
  after?: ComponentViewRecord,
  root?: string,
): OwnedResourceReason[] {
  const present = presentComponents(before, after, root);
  return reasons.flatMap((reason) => {
    const owners = resourceOwners(reason.path, policy, inlineOwners);
    return [...owners]
      .filter((componentId) => present.has(componentId))
      .map((componentId) => ({ componentId, reason }));
  });
}

/** Resolve derived byte-only resource changes to components without inventing Git evidence. */
export function ownedResourceComponents(
  paths: readonly string[],
  policy: ComponentDependencyPolicy,
  inlineOwners: InlineResourceOwners,
  before?: ComponentViewRecord,
  after?: ComponentViewRecord,
  root?: string,
): ReadonlySet<string> {
  const present = presentComponents(before, after, root);
  return new Set(
    paths.flatMap((path) =>
      [...resourceOwners(path, policy, inlineOwners)].filter((id) =>
        present.has(id),
      ),
    ),
  );
}

/** Exact caller declarations remain independent, but cannot bypass CSS exclusion. */
export function exactScreenCssReasons(
  before: ReviewEntry | undefined,
  after: ReviewEntry | undefined,
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

/** Preserve glob and unowned-path evidence alongside retained dependency reasons. */
export function resourceImpact(
  shared: readonly string[],
  unowned: readonly string[],
  reasons: readonly EntryChangeReason[],
): string[] {
  return [
    ...new Set([
      ...shared.filter((path) => !isStylesheetPath(path)),
      ...unowned,
      ...reasons.flatMap((reason) =>
        reason.kind === "dependency" ? [reason.path] : [],
      ),
    ]),
  ].sort();
}

export function propagateOwnedResources(
  evidence: readonly OwnedResourceReason[],
  impacting: Set<string>,
  components: readonly ComponentReview[],
  changes: ChangedEntry[],
): void {
  for (const { componentId, reason } of evidence) {
    const component = components.find((entry) => entry.path === componentId);
    if (!component)
      throw new MoklyError("review-invalid", "resource owner has no component");
    impacting.add(componentId);
    const existing = changes.find(
      (entry) =>
        entry.kind === "component" &&
        (entry.after ?? entry.before)?.path === componentId,
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

function presentComponents(
  before?: ComponentViewRecord,
  after?: ComponentViewRecord,
  root?: string,
): ReadonlySet<string> {
  return new Set([
    ...(root ? [root] : []),
    ...[before, after].flatMap((usage) =>
      usage ? usage.instances.map((instance) => instance.componentId) : [],
    ),
  ]);
}

function resourceOwners(
  path: string,
  policy: ComponentDependencyPolicy,
  inlineOwners: InlineResourceOwners,
): ReadonlySet<string> {
  return new Set([...policy.owners(path), ...(inlineOwners.get(path) ?? [])]);
}
