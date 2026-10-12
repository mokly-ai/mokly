import type { ComponentViewRecord } from "@mokly/viewer";
import type {
  ChangedEntry,
  ComponentReview,
  DependencyReason,
} from "@mokly/viewer/data";
import { canonicalJson, isStylesheetPath } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";

import type { InlineResourceOwners } from "./component_inline_resources.js";
import { uniqueReasons } from "./component_metadata.js";

/** Retained actual-invocation evidence can affect an owner without a saved variant. */
export interface OwnedResourceReason {
  componentId: string;
  reason: DependencyReason;
}

export function ownedResourceReasons(
  reasons: readonly DependencyReason[],
  prefix: string,
  inlineOwners: InlineResourceOwners,
  before?: ComponentViewRecord,
  after?: ComponentViewRecord,
  root?: string,
): OwnedResourceReason[] {
  const present = presentComponents(before, after, root);
  return reasons.flatMap((reason) =>
    [...resourceOwners(reason.path, prefix, inlineOwners, before, after)]
      .filter((componentId) => present.has(componentId))
      .map((componentId) => ({ componentId, reason })),
  );
}

/** Resolve byte-only changes against the same explicit and inferred owners. */
export function ownedResourceComponents(
  paths: readonly string[],
  prefix: string,
  inlineOwners: InlineResourceOwners,
  before?: ComponentViewRecord,
  after?: ComponentViewRecord,
  root?: string,
): ReadonlySet<string> {
  const present = presentComponents(before, after, root);
  return new Set(
    paths.flatMap((path) =>
      [...resourceOwners(path, prefix, inlineOwners, before, after)].filter(
        (id) => present.has(id),
      ),
    ),
  );
}

function presentComponents(
  before?: ComponentViewRecord,
  after?: ComponentViewRecord,
  root?: string,
): ReadonlySet<string> {
  return new Set([
    ...(root ? [root] : []),
    ...[before, after].flatMap(
      (usage) => usage?.instances.map((instance) => instance.componentId) ?? [],
    ),
  ]);
}

function resourceOwners(
  path: string,
  prefix: string,
  inlineOwners: InlineResourceOwners,
  before?: ComponentViewRecord,
  after?: ComponentViewRecord,
): ReadonlySet<string> {
  if (isStylesheetPath(path)) return new Set();
  const publicPath = prefix ? path.slice(prefix.length + 1) : path;
  return new Set([
    ...(inlineOwners.get(path) ?? []),
    ...[before, after].flatMap(
      (usage) =>
        usage?.resources.flatMap((resource) =>
          resource.path === publicPath ? resource.componentIds : [],
        ) ?? [],
    ),
  ]);
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
  }
}

/** Root resource declarations affect material only for non-stylesheet ownership. */
export function rootResourcesChanged(
  before: ComponentViewRecord | undefined,
  after: ComponentViewRecord | undefined,
  root: string | undefined,
): boolean {
  if (!root) return false;
  const paths = (usage: ComponentViewRecord | undefined) =>
    usage?.resources
      .filter(
        (resource) =>
          !isStylesheetPath(resource.path) &&
          resource.componentIds.includes(root),
      )
      .map((resource) => resource.path) ?? [];
  return canonicalJson(paths(before)) !== canonicalJson(paths(after));
}
