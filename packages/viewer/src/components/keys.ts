import type { ComponentInputOwner } from "@mokly/model";

import { sha256 } from "../data/sha256.js";

const INSTANCE_KEY_DOMAIN = "mokly-instance-v1";
const SLOT_KEY_DOMAIN = "mokly-slot-v1";

export function instanceKey(
  owner: ComponentInputOwner,
  slot: string | undefined,
  id: string,
): string {
  return digest([
    INSTANCE_KEY_DOMAIN,
    owner.kind,
    owner.kind === "instance" ? owner.instanceKey : null,
    slot ?? null,
    id,
  ]);
}
export function slotKey(instance: string, name: string): string {
  return digest([SLOT_KEY_DOMAIN, instance, name]);
}
function digest(value: readonly unknown[]): string {
  return sha256(JSON.stringify(value));
}
