import type { ReactNode } from "react";

import type { SlotDraft } from "../generated/sidecar/SlotDraft.js";

import { digest } from "./data.js";
import type {
  AuthoringRuntime,
  Owner,
  RenderSession,
  StyleCapture,
} from "./runtime.js";
import { inputOwner } from "./usage.js";

export interface SlotPlacement {
  draft: SlotDraft;
  owner: Owner;
}

const supplied = new WeakMap<object, SlotPlacement>();

export function rememberSlot(node: object, slot: SlotPlacement): void {
  supplied.set(node, slot);
}

export function rememberedSlot(node: unknown): SlotPlacement | undefined {
  if (node && (typeof node === "object" || typeof node === "function"))
    return supplied.get(node);
}

export function suppliedSlot(
  session: RenderSession,
  parent: Owner,
  instanceKey: string,
  instanceRegionId: string,
  name: string,
  forwarded?: SlotPlacement,
): SlotPlacement {
  const key = digest(["mokly-slot-v1", instanceKey, name]);
  const owner = forwarded?.owner ?? parent;
  const draft: SlotDraft = {
    key,
    instanceKey,
    name,
    owner: inputOwner(owner),
    ...(forwarded ? { sourceSlotKey: forwarded.draft.key } : {}),
    instanceRegionId,
    regionIds: [],
  };
  session.slots.push(draft);
  return { draft, owner: { ...owner, slotKey: owner.slotKey ?? key } };
}

export function supplierStyleOwner(
  owner: Owner,
  session: RenderSession,
  capture: StyleCapture | null,
): string | undefined {
  return owner.kind === "instance"
    ? session.instances.find((record) => record.key === owner.instanceKey)
        ?.componentPath
    : capture?.entryOwner;
}

function markerName(name: string): string {
  return name
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\r", "&#13;")
    .replaceAll("\n", "&#10;");
}

export function slotRegion(
  runtime: AuthoringRuntime,
  session: RenderSession,
  slot: SlotPlacement,
  capture: StyleCapture | null,
): (output: ReactNode) => ReactNode {
  const React = runtime.react;
  const id = session.nextRegion();
  const { draft } = slot;
  draft.regionIds.push(id);
  const owner = { ...slot.owner, seen: new Set<string>() };
  const ownerPath = supplierStyleOwner(owner, session, capture);
  const start = session.boundary(
    `mokly-slot:start id="${id}" instance="${draft.instanceRegionId}" name="${markerName(draft.name)}"`,
  );
  const end = session.boundary(`mokly-slot:end id="${id}"`);
  return (output) =>
    React.createElement(
      React.Fragment,
      null,
      start,
      React.createElement(
        runtime.contexts.owner.Provider,
        { value: owner },
        capture?.wrap(ownerPath, output) ?? output,
      ),
      end,
    );
}
