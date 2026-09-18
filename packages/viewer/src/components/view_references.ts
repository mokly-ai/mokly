import { canonicalJson, exactKeys, invalidData } from "./data.js";
import type {
  ComponentInputOwner,
  ComponentInstanceRecord,
  ComponentSlotRecord,
  ComponentViewRecord,
  ManifestComponent,
} from "./manifest_types.js";

/** Input ownership and physical range placement have separate validated graphs. */
export function validateViewReferences(
  view: ComponentViewRecord,
  components: ReadonlyMap<
    string,
    Pick<ManifestComponent, "propSchema" | "slots">
  >,
  instances: ReadonlyMap<string, ComponentInstanceRecord>,
  slots: ReadonlyMap<string, ComponentSlotRecord>,
  at: string,
  historical = false,
): void {
  const ownerExists = (owner: ComponentInputOwner) => {
    if (owner.kind === "instance" && !instances.has(owner.instanceKey))
      invalidData(at, "unknown instance owner");
  };
  for (const instance of instances.values()) {
    ownerExists(instance.owner);
    if (instance.slotKey !== undefined) {
      const slot = slots.get(instance.slotKey);
      if (
        !slot ||
        canonicalJson(slot.owner) !== canonicalJson(instance.owner) ||
        slot.sourceSlotKey !== undefined
      )
        invalidData(
          at,
          "instance must retain its original slot scope and owner",
        );
    }
    assertAcyclic(
      instance.key,
      (key) => {
        const owner = instances.get(key)?.owner;
        return owner?.kind === "instance" ? owner.instanceKey : undefined;
      },
      at,
    );
  }
  for (const slot of slots.values()) {
    ownerExists(slot.owner);
    const instance = instances.get(slot.instanceKey);
    if (
      !instance ||
      (!historical &&
        !components.get(instance.componentId)?.slots.includes(slot.name))
    )
      invalidData(
        at,
        "slot must name its receiving instance and a declared slot",
      );
    const source = slot.sourceSlotKey
      ? slots.get(slot.sourceSlotKey)
      : undefined;
    if (slot.sourceSlotKey && !source)
      invalidData(at, "unknown forwarded slot source");
    if (
      canonicalJson(slot.owner) !==
      canonicalJson(source?.owner ?? instance.owner)
    )
      invalidData(at, "slot ownership mismatch");
    assertAcyclic(slot.key, (key) => slots.get(key)?.sourceSlotKey, at);
  }
  const seen = new Set<string>();
  const referencedInstances = new Set<string>();
  for (const [index, range] of view.ranges.entries()) {
    exactKeys(range, ["id", "target", "parentId"], at);
    if (
      range.id !== `r-${index}` ||
      (range.parentId !== undefined && !seen.has(range.parentId))
    )
      invalidData(at, "invalid range identity or parent");
    exactKeys(range.target, ["kind", "instanceKey", "slotKey"], at);
    if (range.target.kind === "instance") {
      if (
        Object.hasOwn(range.target, "slotKey") ||
        !instances.has(range.target.instanceKey)
      )
        invalidData(at, "unknown range instance");
      referencedInstances.add(range.target.instanceKey);
    } else if (range.target.kind === "slot") {
      if (
        Object.hasOwn(range.target, "instanceKey") ||
        !slots.has(range.target.slotKey)
      )
        invalidData(at, "unknown range slot");
    } else invalidData(at, "invalid range target");
    seen.add(range.id);
  }
  if (referencedInstances.size !== instances.size)
    invalidData(
      at,
      "every invoked instance requires a range, including empty output",
    );
}

function assertAcyclic(
  start: string,
  next: (key: string) => string | undefined,
  at: string,
): void {
  const seen = new Set<string>();
  let current: string | undefined = start;
  while (current !== undefined) {
    if (seen.has(current)) invalidData(at, "cyclic ownership references");
    seen.add(current);
    current = next(current);
  }
}
