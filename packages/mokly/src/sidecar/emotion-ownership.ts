import type { StyleAttribution } from "../generated/sidecar/StyleAttribution.js";

import { StyleOwners } from "./style-ownership.js";

interface Serialized {
  name: string;
  styles: string;
}

export interface EmotionCache {
  inserted: Record<string, string | true | undefined>;
  insert(
    selector: string,
    serialized: Serialized,
    sheet: unknown,
    shouldCache: boolean,
  ): unknown;
}

/** Observe cache hits as well as inserts without regenerating or renaming CSS. */
export function emotionOwners(root: EmotionCache): {
  forOwner(owner: string | undefined): EmotionCache;
  records(ids: readonly string[]): StyleAttribution[];
} {
  const ledger = new StyleOwners();
  const views = new Map<string | undefined, EmotionCache>();
  return {
    forOwner(owner) {
      let view = views.get(owner);
      if (view) return view;
      const inserted = new Proxy(root.inserted, {
        get(target, key, receiver) {
          if (typeof key === "string") ledger.use(key, owner);
          return Reflect.get(target, key, receiver);
        },
      });
      const insert = (
        selector: string,
        serialized: Serialized,
        sheet: unknown,
        shouldCache: boolean,
      ) => {
        ledger.use(serialized.name, owner);
        return root.insert(selector, serialized, sheet, shouldCache);
      };
      view = new Proxy(root, {
        get(target, key, receiver) {
          if (key === "inserted") return inserted;
          if (key === "insert") return insert;
          return Reflect.get(target, key, receiver);
        },
      });
      views.set(owner, view);
      return view;
    },
    records(ids) {
      const kept = new Set(ids);
      return ledger.records((id) => {
        const css = root.inserted[id];
        return kept.has(id) && typeof css === "string" ? css : undefined;
      });
    },
  };
}
