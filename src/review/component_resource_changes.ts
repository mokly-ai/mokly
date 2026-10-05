import type { ComponentMaterialReader } from "./component_resources.js";
import { decideReferencedResource } from "./deleted_resource.js";
import type { MoveResources } from "./moves/resources.js";

/** Compare retained resource membership and bytes independently of Git tracking. */
export async function changedResourceBytes(
  before: ReadonlySet<string>,
  after: ReadonlySet<string>,
  beforeReader: ComponentMaterialReader,
  afterReader: ComponentMaterialReader,
  identities?: MoveResources,
): Promise<ReadonlySet<string>> {
  const changed = new Set<string>();
  const equal = identities?.equivalent(before, after);
  for (const resource of new Set([...before, ...after])) {
    if (equal?.has(resource)) continue;
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
