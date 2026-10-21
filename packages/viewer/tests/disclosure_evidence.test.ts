import assert from "node:assert/strict";
import test from "node:test";

import type { Catalogue } from "../src/shell/catalogue.js";
import { initialSnapshot } from "../src/shell/data_commit.js";
import {
  catalogueNavSections,
  defaultDisclosures,
} from "../src/shell/nav_model.js";
import { shellStore } from "../src/shell/store_actions.js";
import { withFilterSelection } from "../src/shell/store_filters.js";
import type { ShellState } from "../src/shell/store_state.js";
import { viewerContext } from "../src/viewer/projection.js";

import {
  baseModel,
  initialState,
  publish,
  republished,
  variantKey,
  withRemovedVariant,
} from "./disclosure_evidence_fixture.js";

function persistedStore(catalogue: Catalogue, initial: ShellState) {
  let state = initial;
  const stateRef = { current: state };
  const store = shellStore({
    catalogue,
    context: viewerContext(catalogue.publicModel, state.selection),
    embedded: false,
    interactive: false,
    navigation: {
      navigateFrame() {},
      onShellClick() {},
      onShellKeyDown() {},
      openFrame() {},
    },
    propose() {},
    sections: catalogueNavSections(catalogue),
    setState(action) {
      state = typeof action === "function" ? action(state) : action;
      stateRef.current = state;
    },
    state,
    stateRef,
  });
  return { store, state: () => state };
}

test("a publication adding a Removed variant reconciles Collapse all and v4 saves", (context) => {
  const saved = new Map<string, string>();
  const previousStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem(key: string) {
        return saved.get(key) ?? null;
      },
      removeItem(key: string) {
        saved.delete(key);
      },
      setItem(key: string, value: string) {
        saved.set(key, value);
      },
    },
  });
  context.after(() => {
    if (previousStorage)
      Object.defineProperty(globalThis, "localStorage", previousStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  });

  const base = baseModel();
  const state = initialState(base, "/view/product/browse/home/");
  assert.equal(Object.hasOwn(state.disclosures, variantKey), false);
  const added = withRemovedVariant(base, base.revision + 1);
  const adopted = publish(initialSnapshot(base), state, added);
  assert.equal(adopted.state.disclosures[variantKey], true);
  assert.deepEqual(
    Object.keys(adopted.state.disclosures).sort(),
    Object.keys(
      defaultDisclosures(
        catalogueNavSections(adopted.snapshot.catalogue),
        "product/browse/home",
      ),
    ).sort(),
  );
  const currentStore = persistedStore(
    adopted.snapshot.catalogue,
    adopted.state,
  );
  currentStore.store.collapseAll();
  assert.equal(currentStore.state().disclosures[variantKey], false);
  assert.equal(
    JSON.parse(saved.get("mokly:nav-disclosure:v4") ?? "{}")?.[variantKey],
    false,
  );

  const removed = republished(base, added.revision + 1);
  const retracted = publish(adopted.snapshot, currentStore.state(), removed);
  assert.equal(Object.hasOwn(retracted.state.disclosures, variantKey), false);
  assert.deepEqual(
    Object.keys(retracted.state.disclosures).sort(),
    Object.keys(
      defaultDisclosures(
        catalogueNavSections(retracted.snapshot.catalogue),
        "product/browse/home",
      ),
    ).sort(),
  );
  const retractedStore = persistedStore(
    retracted.snapshot.catalogue,
    retracted.state,
  );
  retractedStore.store.collapseAll();
  assert.equal(
    Object.hasOwn(
      JSON.parse(saved.get("mokly:nav-disclosure:v4") ?? "{}"),
      variantKey,
    ),
    false,
  );
});

test("a filtered publication reconciles current and pre-filter baseline independently", () => {
  const base = baseModel();
  const initial = initialState(base, "/");
  const state = withFilterSelection(initial, {
    ...initial.selection,
    search: "Home",
  });
  const added = withRemovedVariant(base, base.revision + 1);
  const adopted = publish(initialSnapshot(base), state, added);
  assert.equal(adopted.state.disclosures[variantKey], true);
  assert.equal(adopted.state.filterBaseline?.[variantKey], false);

  const removed = republished(base, added.revision + 1);
  const retracted = publish(adopted.snapshot, adopted.state, removed);
  assert.equal(Object.hasOwn(retracted.state.disclosures, variantKey), false);
  assert.equal(
    Object.hasOwn(retracted.state.filterBaseline ?? {}, variantKey),
    false,
  );
});

test("a publication preserves a collapsed active folder with and without new navigation", () => {
  const base = baseModel();
  const activeFolder = "folder:specs:product/browse";
  const initial = initialState(base, "/view/product/browse/home/");
  assert.equal(initial.disclosures[activeFolder], true);
  const collapsed = {
    ...initial,
    disclosures: { ...initial.disclosures, [activeFolder]: false },
  };
  const unchangedModel = republished(base, base.revision + 1);
  const unchanged = publish(initialSnapshot(base), collapsed, unchangedModel);
  assert.equal(unchanged.state.disclosures[activeFolder], false);

  const added = withRemovedVariant(base, unchangedModel.revision + 1);
  const changed = publish(unchanged.snapshot, unchanged.state, added);
  assert.equal(changed.state.disclosures[activeFolder], false);
  assert.equal(changed.state.disclosures[variantKey], true);
});
