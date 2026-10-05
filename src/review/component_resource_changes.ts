import type { ComponentMaterialReader } from "./component_resources.js";
import { decideReferencedResource } from "./deleted_resource.js";

/** Derived resources may be ignored by Git, so compare their retained bytes as well. */
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
      !before.has(resource),
      true,
    );
    if (!before.has(resource) || decision.byteChanged) changed.add(resource);
  }
  return changed;
}
