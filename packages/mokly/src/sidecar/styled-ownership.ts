import type { Context, ReactNode } from "react";

import type { StyleAttribution } from "../generated/sidecar/StyleAttribution.js";

import { StyleOwners } from "./style-ownership.js";

interface Sheet {
  hasNameForId(id: string, name: string): boolean;
  insertRules(id: string, name: string, rules: string[]): unknown;
}

export interface StyledAdapter {
  ServerStyleSheet: new () => {
    instance: Sheet;
    collectStyles(node: ReactNode): ReactNode;
    getStyleElement(): readonly {
      props: { dangerouslySetInnerHTML?: { __html?: string } };
    }[];
    seal(): void;
  };
  StyleSheetManager: React.ElementType;
  StyleSheetContext: Context<{ styleSheet: Sheet; [key: string]: unknown }>;
}

/** Share the real sheet, its name cache and global counters across owner views. */
export function styledOwners(
  root: Sheet,
  fallback: string | undefined,
): {
  forOwner(owner: string | undefined, current?: Sheet): Sheet;
  records(): StyleAttribution[];
  inlineAttribution(): (css: string) => StyleAttribution[] | undefined;
} {
  const sources = new WeakMap<Sheet, Sheet>();
  const captures = new Map<
    Sheet,
    {
      ledger: StyleOwners;
      views: Map<string | undefined, Sheet>;
      has: Sheet["hasNameForId"];
      insert: Sheet["insertRules"];
    }
  >();
  function capture(sheet: Sheet) {
    let state = captures.get(sheet);
    if (!state) {
      state = {
        ledger: new StyleOwners(),
        views: new Map(),
        has: sheet.hasNameForId.bind(sheet),
        insert: sheet.insertRules.bind(sheet),
      };
      captures.set(sheet, state);
    }
    return state;
  }
  function forOwner(owner: string | undefined, current?: Sheet): Sheet {
    const sheet = current ? (sources.get(current) ?? current) : root;
    const { ledger, views, has, insert } = capture(sheet);
    let view = views.get(owner);
    if (view) return view;
    const methods = {
      hasNameForId(id: string, name: string) {
        ledger.use(JSON.stringify([id, name]), owner);
        return has(id, name);
      },
      insertRules(id: string, name: string, rules: string[]) {
        ledger.use(JSON.stringify([id, name]), owner, rules.join("\n"));
        return insert(id, name, rules);
      },
    };
    view = new Proxy(sheet, {
      get(target, key, receiver) {
        if (key === "hasNameForId") return methods.hasNameForId;
        if (key === "insertRules") return methods.insertRules;
        const value: unknown = Reflect.get(target, key, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    sources.set(view, sheet);
    views.set(owner, view);
    return view;
  }
  // collectStyles uses the root object; nested views use the same original methods.
  const base = forOwner(fallback);
  root.hasNameForId = base.hasNameForId;
  root.insertRules = base.insertRules;
  return {
    forOwner,
    records: () => capture(root).ledger.records(),
    inlineAttribution() {
      const tokens = new Map<string, StyleAttribution[]>();
      for (const { ledger } of captures.values()) {
        for (const [identity, record] of ledger.entries()) {
          let records = tokens.get(identity);
          if (!records) tokens.set(identity, (records = []));
          records.push(record);
        }
      }
      return (css) => {
        const records = new Map<string, StyleAttribution>();
        const normalized = css.replaceAll("/*!sc*/\n", "\n");
        for (const match of css.matchAll(
          /data-styled\.g\d+\[id="([^"]+)"\]\{content:"([^"]*)"\}/g,
        )) {
          for (const name of match[2]!.split(",")) {
            for (const record of tokens.get(JSON.stringify([match[1], name])) ??
              []) {
              if (normalized.includes(record.css))
                records.set(JSON.stringify(record), record);
            }
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
