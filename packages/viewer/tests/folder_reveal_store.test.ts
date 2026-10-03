import assert from "node:assert/strict";
import test from "node:test";

import type { CatalogueReadModel } from "../src/catalogue/types.js";
import { catalogueNavSections } from "../src/shell/nav_model.js";
import { shellStore } from "../src/shell/store_actions.js";
import { withFilterSelection } from "../src/shell/store_filters.js";
import type { ShellState } from "../src/shell/store_state.js";
import { viewerCatalogue, viewerContext } from "../src/viewer/projection.js";

import { baseModel, initialState } from "./disclosure_evidence_fixture.js";

/** A standalone or embedded store over the public fixture with fake storage. */
function harness(
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

function fakeStorage(context: test.TestContext): Map<string, string> {
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

test("revealFolder opens and focuses a folder, saving v4 without touching earlier keys", (context) => {
  const saved = fakeStorage(context);
  saved.set("mokly:nav-disclosure:v3", '{"folder:pages:product/browse":false}');
  saved.set("mokly:nav-disclosure:v2", '["collection:pages:Product"]');
  const model = baseModel();
  const initial = initialState(model, "/");
  const folder = "folder:specs:product/browse";
  assert.equal(initial.disclosures[folder], false);
  const { state, store } = harness(model, initial);
  store.revealFolder("specs", "product/browse");
  assert.equal(state().disclosures[folder], true);
  assert.equal(state().disclosures["folder:specs:product"], true);
  assert.deepEqual(state().revealedFolder, { key: folder });
  assert.equal(state().drawerOpen, false);
  assert.equal(state().route, initial.route);
  assert.deepEqual(
    JSON.parse(saved.get("mokly:nav-disclosure:v4") ?? "{}")[folder],
    true,
  );
  assert.equal(
    saved.get("mokly:nav-disclosure:v3"),
    '{"folder:pages:product/browse":false}',
  );
  assert.equal(
    saved.get("mokly:nav-disclosure:v2"),
    '["collection:pages:Product"]',
  );
  const first = state().revealedFolder;
  store.revealFolder("specs", "product/browse");
  assert.notEqual(state().revealedFolder, first);
});

test("revealFolder clears a hiding search and keeps the revealed folder after the baseline returns", (context) => {
  const saved = fakeStorage(context);
  const model = baseModel();
  const initial = initialState(model, "/");
  const filtered = withFilterSelection(initial, {
    ...initial.selection,
    search: "zzz",
  });
  const { state, store } = harness(model, filtered);
  store.revealFolder("specs", "product/browse");
  assert.equal(state().selection.search, "");
  assert.equal(state().query, "");
  assert.equal(state().filterBaseline, undefined);
  assert.equal(state().disclosures["folder:specs:product/browse"], true);
  assert.equal(
    JSON.parse(saved.get("mokly:nav-disclosure:v4") ?? "{}")[
      "folder:specs:product/browse"
    ],
    true,
  );
});

test("revealFolder leaves Changes for All only when nothing inside changed", (context) => {
  fakeStorage(context);
  const model = baseModel();
  const initial = initialState(model, "/");
  const changes = withFilterSelection(initial, {
    ...initial.selection,
    view: "changes",
  });
  const unchanged = harness(model, changes, { changedEntries: ["guide"] });
  unchanged.store.revealFolder("specs", "product/browse");
  assert.equal(unchanged.state().selection.view, "all");
  const changed = harness(model, changes, {
    changedEntries: ["product/browse/details"],
  });
  changed.store.revealFolder("specs", "product/browse");
  assert.equal(changed.state().selection.view, "changes");
  assert.equal(
    changed.state().filterBaseline?.["folder:specs:product/browse"],
    true,
  );
});

test("an embedded reveal proposes the cleared filters and opens both disclosure maps", (context) => {
  const saved = fakeStorage(context);
  const model = baseModel();
  const initial = initialState(model, "/");
  const filtered = withFilterSelection(initial, {
    ...initial.selection,
    search: "zzz",
  });
  const { proposals, state, store } = harness(model, filtered, {
    embedded: true,
  });
  store.revealFolder("specs", "product/browse");
  assert.deepEqual(proposals, [[{ search: "", tags: [] }, ""]]);
  assert.equal(state().selection.search, "zzz");
  assert.equal(state().disclosures["folder:specs:product/browse"], true);
  assert.equal(state().filterBaseline?.["folder:specs:product/browse"], true);
  assert.equal(saved.size, 0);
});

test("revealing an unknown folder changes nothing", (context) => {
  fakeStorage(context);
  const model = baseModel();
  const initial = initialState(model, "/");
  const { state, store } = harness(model, initial);
  store.revealFolder("specs", "missing");
  store.revealFolder("components", "product/browse");
  assert.equal(state(), initial);
});
