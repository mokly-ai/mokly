import type { TestContext } from "node:test";

import type { CatalogueReadModel } from "../src/catalogue/types.js";
import { catalogueNavSections } from "../src/shell/nav_model.js";
import { shellStore } from "../src/shell/store_actions.js";
import type { ShellState } from "../src/shell/store_state.js";
import { viewerCatalogue, viewerContext } from "../src/viewer/projection.js";

/** A standalone or embedded store over the public fixture with fake storage. */
export function harness(
  model: CatalogueReadModel,
  initial: ShellState,
  options: { embedded?: boolean; changedEntries?: readonly string[] } = {},
) {
  const catalogue = viewerCatalogue(model);
  let state = initial;
  const stateRef = { current: state };
  const proposals: unknown[] = [];
  const store = shellStore({
    catalogue,
    context: {
      ...viewerContext(model, state.selection),
      changedEntries: options.changedEntries ?? [],
      changesStatus: "ready",
    },
    embedded: options.embedded ?? false,
    interactive: true,
    navigation: {
      navigateFrame() {},
      onShellClick() {},
      onShellKeyDown() {},
      openFrame() {},
    },
    propose(selection, rawQuery) {
      proposals.push([selection, rawQuery]);
    },
    sections: catalogueNavSections(catalogue),
    setState(action) {
      state = typeof action === "function" ? action(state) : action;
      stateRef.current = state;
    },
    state,
    stateRef,
  });
  return { proposals, state: () => state, store };
}

export function fakeStorage(context: TestContext): Map<string, string> {
  const saved = new Map<string, string>();
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => saved.get(key) ?? null,
      removeItem: (key: string) => saved.delete(key),
      setItem: (key: string, value: string) => saved.set(key, value),
    },
  });
  context.after(() => {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  });
  return saved;
}
