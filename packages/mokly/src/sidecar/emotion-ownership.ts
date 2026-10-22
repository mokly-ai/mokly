import type { StyleAttribution } from "../generated/sidecar/StyleAttribution.js";

import { StyleOwners } from "./style-ownership.js";

interface Serialized {
  name: string;
  styles: string;
  next?: Serialized;
}

export interface EmotionCache {
  key?: string;
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
  forOwner(
    owner: string | undefined,
    current?: EmotionCache | null,
  ): EmotionCache;
  records(ids: readonly string[]): StyleAttribution[];
  inlineAttribution(): (
    token: string,
    css: string,
  ) => StyleAttribution[] | undefined;
} {
  const sources = new WeakMap<EmotionCache, EmotionCache>();
  const captures = new Map<
    EmotionCache,
    {
      ledger: StyleOwners;
      views: Map<string | undefined, EmotionCache>;
    }
  >();
  function capture(cache: EmotionCache) {
    let state = captures.get(cache);
    if (!state) {
      state = { ledger: new StyleOwners(), views: new Map() };
      captures.set(cache, state);
    }
    return state;
  }
  return {
    forOwner(owner, current) {
      const cache = current ? (sources.get(current) ?? current) : root;
      const { ledger, views } = capture(cache);
      let view = views.get(owner);
      if (view) return view;
      const inserted = new Proxy(cache.inserted, {
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
        for (let next = serialized.next; next; next = next.next)
          ledger.link(serialized.name, next.name);
        const result = cache.insert(selector, serialized, sheet, shouldCache);
        if (typeof result === "string")
          ledger.use(serialized.name, owner, result);
        return result;
      };
      view = new Proxy(cache, {
        get(target, key, receiver) {
          if (key === "inserted") return inserted;
          if (key === "insert") return insert;
          return Reflect.get(target, key, receiver);
        },
      });
      sources.set(view, cache);
      views.set(owner, view);
      return view;
    },
    records(ids) {
      const kept = new Set(ids);
      return capture(root).ledger.records((id) => {
        const css = root.inserted[id];
        return kept.has(id) && typeof css === "string" ? css : undefined;
      });
    },
    inlineAttribution() {
      const tokens = new Map<string, StyleAttribution[]>();
      for (const [cache, { ledger }] of captures) {
        if (!cache.key) continue;
        for (const [id, record] of ledger.entries()) {
          for (const key of [cache.key, `${cache.key}-global`]) {
            const token = `${key} ${id}`;
            let records = tokens.get(token);
            if (!records) tokens.set(token, (records = []));
            records.push(record);
          }
        }
      }
      return (token, css) => {
        const [key, ...ids] = token.split(/\s+/);
        const records = new Map<string, StyleAttribution>();
        for (const id of ids) {
          for (const record of tokens.get(`${key} ${id}`) ?? []) {
            if (css.includes(record.css))
              records.set(JSON.stringify(record), record);
          }
        }
        return records.size
          ? [...records]
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
              .map(([, record]) => record)
          : undefined;
      };
    },
  };
}
