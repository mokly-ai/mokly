import { sha256 } from "../data/sha256.js";

import type { ComponentInputOwner } from "./manifest_types.js";

const INSTANCE_KEY_DOMAIN = "mokabook-instance-v1";
const SLOT_KEY_DOMAIN = "mokabook-slot-v1";

export const isComponentKey = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

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
