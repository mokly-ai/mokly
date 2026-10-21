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
} {
  const ledger = new StyleOwners();
  const has = root.hasNameForId.bind(root);
  const insert = root.insertRules.bind(root);
  const ownedViews = new WeakSet<object>();
  const views = new Map<string | undefined, Sheet>();
  function forOwner(owner: string | undefined, current?: Sheet): Sheet {
    if (current && current !== root && !ownedViews.has(current)) return current;
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
    view = new Proxy(root, {
      get(target, key, receiver) {
        if (key === "hasNameForId") return methods.hasNameForId;
        if (key === "insertRules") return methods.insertRules;
        const value: unknown = Reflect.get(target, key, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    ownedViews.add(view);
    views.set(owner, view);
    return view;
  }
  // collectStyles uses the root object; nested views use the same original methods.
  const base = forOwner(fallback);
  root.hasNameForId = base.hasNameForId;
  root.insertRules = base.insertRules;
  return { forOwner, records: () => ledger.records() };
}
