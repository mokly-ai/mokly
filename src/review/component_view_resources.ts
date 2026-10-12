/** Compare resource bytes using stored references and inserted-link seeds. */
import { isStylesheetPath } from "@mokly/viewer/data";

import { changedResourceBytes } from "./component_resource_changes.js";
import type { ComponentViewContext } from "./component_view_types.js";
import type { ResourceDocument } from "./resource_comparison.js";

interface ResourceByteProof {
  before: ReadonlySet<string>;
  after: ReadonlySet<string>;
  changes: ReadonlySet<string>;
}

export async function componentResourceByteChanges(
  context: ComponentViewContext,
  before: ResourceDocument,
  after: ResourceDocument,
  excluded?: (path: string) => boolean,
): Promise<ResourceByteProof> {
  const base = await context.beforeReader.resources(
    before.path,
    before.html,
    excluded,
    {
      references: before.references,
      insertedStylesheets: before.insertedStylesheets,
    },
  );
  const head = await context.afterReader.resources(
    after.path,
    after.html,
    excluded,
    {
      references: after.references,
      insertedStylesheets: after.insertedStylesheets,
    },
  );
  return {
    before: base,
    after: head,
    changes: await changedResourceBytes(
      base,
      head,
      context.beforeReader,
      context.afterReader,
      context.resourceIdentity,
    ),
  };
}

/** A projected-only CSS edge cannot invent material outside the actual closure. */
export function byteMaterialChanged(
  proof: ResourceByteProof,
  actual: ResourceByteProof,
  changed: ReadonlySet<string>,
  repoPath: (route: string) => string,
): boolean {
  return [...proof.changes].some(
    (route) =>
      !changed.has(repoPath(route)) &&
      (!isStylesheetPath(route) ||
        (actual.changes.has(route) &&
          actual.before.has(route) &&
          actual.after.has(route))),
  );
}
