import type { ComponentMaterialReader } from "./component_resources.js";
import { decideReferencedResource } from "./deleted_resource.js";

/** Compare retained resource membership and bytes independently of Git tracking. */
export async function changedResourceBytes(
  before: ReadonlySet<string>,
  after: ReadonlySet<string>,
  beforeReader: ComponentMaterialReader,
  afterReader: ComponentMaterialReader,
): Promise<ReadonlySet<string>> {
  const changed = new Set<string>();
  for (const resource of new Set([...before, ...after])) {
    if (!after.has(resource)) {
      changed.add(resource);
      continue;
    }
    const decision = await decideReferencedResource(
      resource,
      beforeReader,
      afterReader,
    );
    if (!before.has(resource) || decision.byteChanged) changed.add(resource);
  }
  return changed;
}
