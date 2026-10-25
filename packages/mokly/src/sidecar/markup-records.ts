import { parseFragment } from "parse5";

import type { RenderSession } from "../authoring/runtime.js";
import type { MarkerDraft } from "../generated/sidecar/MarkerDraft.js";
import type { MarkerPayload } from "../generated/sidecar/MarkerPayload.js";

/** Capture only boundaries whose private template token has been authenticated. */
export function markerRecords(session: RenderSession) {
  const stack: { id: string; kind: string }[] = [];
  const records: MarkerDraft[] = [];
  return {
    records,
    owner(): string[] {
      for (const marker of [...stack].reverse()) {
        const instance = session.instances.find(
          (instance) => instance.regionId === marker.id,
        );
        if (instance) return [instance.componentPath];
        const slot = session.slots.find((slot) =>
          slot.regionIds.includes(marker.id),
        );
        if (slot) {
          if (slot.owner.kind === "entry") return [];
          const ownerKey = slot.owner.instanceKey;
          const owner = session.instances.find(
            (instance) => instance.key === ownerKey,
          );
          return owner ? [owner.componentPath] : [];
        }
      }
      return [];
    },
    add(comment: string) {
      const match =
        /^mokly-(instance|slot|ignore|link|output):(start|end) (.*)$/.exec(
          comment,
        );
      if (!match) throw new Error("unknown authenticated marker");
      const node = parseFragment(`<i ${match[3]}></i>`).childNodes[0];
      if (!node || !("attrs" in node)) throw new Error("invalid marker");
      const attributes = Object.fromEntries(
        node.attrs.map((attribute) => [attribute.name, attribute.value]),
      );
      const id = attributes.id!;
      if (match[2] === "end") {
        const start = stack.pop();
        if (start?.id !== id || start.kind !== match[1])
          throw new Error("crossing or reordered generated markers");
        return;
      }
      let payload: MarkerPayload;
      if (match[1] === "output") {
        payload = { kind: "output" };
      } else if (match[1] === "instance") {
        const instance = session.instances.find(
          (instance) => instance.regionId === id,
        );
        if (!instance) throw new Error("instance placement has no input");
        payload = { kind: "instance", key: instance.key };
      } else if (match[1] === "slot") {
        const slot = session.slots.find(
          (slot) =>
            slot.instanceRegionId === attributes.instance &&
            slot.regionIds.includes(id),
        );
        if (!slot) throw new Error("slot placement has no input");
        payload = { kind: "slot", key: slot.key };
      } else if (match[1] === "ignore") {
        payload = {
          kind: "ignore",
          ...(attributes.key ? { materialKey: attributes.key } : {}),
        };
      } else payload = { kind: "link", to: attributes.to! };
      records.push({
        id,
        ...(stack.length ? { parentId: stack.at(-1)!.id } : {}),
        payload,
      });
      stack.push({ id, kind: match[1]! });
    },
    finish() {
      if (stack.length) throw new Error("unclosed generated marker");
    },
  };
}
