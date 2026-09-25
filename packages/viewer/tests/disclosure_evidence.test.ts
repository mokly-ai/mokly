import assert from "node:assert/strict";
import test from "node:test";

import { readCatalogue } from "../src/catalogue/reader.js";
import type { CatalogueReadModel } from "../src/catalogue/types.js";
import { commitViewerEvidence } from "../src/shell/capability_commit.js";
import {
  catalogueNavSections,
  defaultDisclosures,
} from "../src/shell/nav_model.js";
import {
  shellRecoverySnapshot,
  shellStore,
} from "../src/shell/store_actions.js";
import { withFilterSelection } from "../src/shell/store_filters.js";
import type { ShellState } from "../src/shell/store_state.js";
import { viewerCatalogue, viewerContext } from "../src/viewer/projection.js";

import {
  baseModel,
  initialState,
  revision,
  source,
  variantKey,
  withRemovedVariant,
} from "./disclosure_evidence_fixture.js";

function persistedStore(model: CatalogueReadModel, initial: ShellState) {
  const catalogue = viewerCatalogue(model);
  let state = initial;
  const stateRef = { current: state };
  const store = shellStore({
    catalogue,
    context: viewerContext(model, state.selection),
    embedded: false,
    interactive: false,
    navigation: {
      navigateFrame() {},
      onShellClick() {},
      onShellKeyDown() {},
      openFrame() {},
      selectVariant() {},
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

test("adopting a Removed variant reconciles Collapse all, recovery, and v3 saves", (context) => {
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
  const current = viewerCatalogue(base);
  const state = initialState(base, "/view/screens/home.html");
  assert.equal(Object.hasOwn(state.disclosures, variantKey), false);
  const added = withRemovedVariant(base, base.revision.evidence + 1);
  const adopted = commitViewerEvidence(
    { catalogue: current, source: source(base) },
    state,
    revision(added, source(base), "screens/home.html"),
  );
  assert.ok(adopted);
  assert.equal(adopted.state.disclosures[variantKey], true);
  assert.deepEqual(
    Object.keys(adopted.state.disclosures).sort(),
    Object.keys(
      defaultDisclosures(
        catalogueNavSections(adopted.snapshot.catalogue),
        "screens/home.html",
      ),
    ).sort(),
  );
  const currentStore = persistedStore(added, adopted.state);
  currentStore.store.collapseAll();
  assert.equal(currentStore.state().disclosures[variantKey], false);
  assert.equal(
    currentStore.store.recoverySnapshot().disclosures?.[variantKey],
    false,
  );
  assert.equal(
    JSON.parse(saved.get("mokly:nav-disclosure:v3") ?? "{}")?.[variantKey],
    false,
  );

  const removed = readCatalogue({
    ...base,
    revision: { ...base.revision, evidence: added.revision.evidence + 1 },
  });
  const retracted = commitViewerEvidence(
    adopted.snapshot,
    currentStore.state(),
    revision(removed, adopted.snapshot.source!, "screens/home.html"),
  );
  assert.ok(retracted);
  assert.equal(Object.hasOwn(retracted.state.disclosures, variantKey), false);
  assert.deepEqual(
    Object.keys(retracted.state.disclosures).sort(),
    Object.keys(
      defaultDisclosures(
        catalogueNavSections(retracted.snapshot.catalogue),
        "screens/home.html",
      ),
    ).sort(),
  );
  assert.equal(
    Object.hasOwn(
      shellRecoverySnapshot(retracted.state, false).disclosures ?? {},
      variantKey,
    ),
    false,
  );
  const retractedStore = persistedStore(removed, retracted.state);
  retractedStore.store.collapseAll();
  assert.equal(
    Object.hasOwn(
      JSON.parse(saved.get("mokly:nav-disclosure:v3") ?? "{}"),
      variantKey,
    ),
    false,
  );
});

test("filtered evidence reconciles current and pre-filter baseline independently", () => {
  const base = baseModel();
  const current = viewerCatalogue(base);
  const initial = initialState(base, "/");
  const state = withFilterSelection(initial, {
    ...initial.selection,
    search: "Home",
  });
  const added = withRemovedVariant(base, base.revision.evidence + 1);
  const adopted = commitViewerEvidence(
    { catalogue: current, source: source(base) },
    state,
    revision(added, source(base), null),
  );
  assert.ok(adopted);
  assert.equal(adopted.state.disclosures[variantKey], true);
  assert.equal(adopted.state.filterBaseline?.[variantKey], false);

  const removed = readCatalogue({
    ...base,
    revision: { ...base.revision, evidence: added.revision.evidence + 1 },
  });
  const retracted = commitViewerEvidence(
    adopted.snapshot,
    adopted.state,
    revision(removed, adopted.snapshot.source!, null),
  );
  assert.ok(retracted);
  assert.equal(Object.hasOwn(retracted.state.disclosures, variantKey), false);
  assert.equal(
    Object.hasOwn(retracted.state.filterBaseline ?? {}, variantKey),
    false,
  );
});

test("background evidence preserves a collapsed active folder with and without new navigation", () => {
  const base = baseModel();
  const current = viewerCatalogue(base);
  const activeFolder = "folder:pages:Product/Browse";
  const initial = initialState(base, "/view/screens/home.html");
  assert.equal(initial.disclosures[activeFolder], true);
  const collapsed = {
    ...initial,
    disclosures: { ...initial.disclosures, [activeFolder]: false },
  };
  const unchangedModel = readCatalogue({
    ...base,
    revision: { ...base.revision, evidence: base.revision.evidence + 1 },
  });
  const unchanged = commitViewerEvidence(
    { catalogue: current, source: source(base) },
    collapsed,
    revision(unchangedModel, source(base), "screens/home.html"),
  );
  assert.ok(unchanged);
  assert.equal(unchanged.state.disclosures[activeFolder], false);

  const added = withRemovedVariant(base, unchangedModel.revision.evidence + 1);
  const changed = commitViewerEvidence(
    unchanged.snapshot,
    unchanged.state,
    revision(added, unchanged.snapshot.source!, "screens/home.html"),
  );
  assert.ok(changed);
  assert.equal(changed.state.disclosures[activeFolder], false);
  assert.equal(changed.state.disclosures[variantKey], true);
});
