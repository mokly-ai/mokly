/** Compare resource bytes using the same stored references and inserted-link seeds. */
import { changedResourceBytes } from "./component_resource_changes.js";
import type { ComponentViewContext } from "./component_view_types.js";
import type { ResourceDocument } from "./resource_comparison.js";

export async function componentResourceByteChanges(
  context: ComponentViewContext,
  before: ResourceDocument,
  after: ResourceDocument,
  excluded?: (path: string) => boolean,
): Promise<ReadonlySet<string>> {
  return changedResourceBytes(
    await context.beforeReader.resources(before.path, before.html, excluded, {
      references: before.references,
      insertedStylesheets: before.insertedStylesheets,
    }),
    await context.afterReader.resources(after.path, after.html, excluded, {
      references: after.references,
      insertedStylesheets: after.insertedStylesheets,
    }),
    context.beforeReader,
    context.afterReader,
    context.resourceIdentity,
  );
}
