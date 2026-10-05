import assert from "node:assert/strict";
import test from "node:test";

import { withFilterSelection } from "../src/shell/store_filters.js";

import { baseModel, initialState } from "./disclosure_evidence_fixture.js";
import { fakeStorage, harness } from "./navigation_store_fixture.js";

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
  assert.deepEqual(state().revealedFolder, {
    key: folder,
    selection: state().selection,
  });
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

test("an embedded reveal proposes a tag-only query cleared as a whole", (context) => {
  fakeStorage(context);
  const model = baseModel();
  const initial = initialState(model, "/");
  const tagged = withFilterSelection(initial, {
    ...initial.selection,
    tags: ["zzz"],
  });
  const { proposals, state, store } = harness(model, tagged, {
    embedded: true,
  });
  store.revealFolder("specs", "product/browse");
  assert.deepEqual(proposals, [[{ search: "", tags: [] }, ""]]);
  assert.deepEqual(state().revealedFolder?.selection.tags, ["zzz"]);
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

for (const embedded of [false, true]) {
  test(`${embedded ? "embedded" : "standalone"}: an impossible reveal keeps filters, drawer, and disclosures`, (context) => {
    const saved = fakeStorage(context);
    const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { matchMedia: () => ({ matches: true }) },
    });
    context.after(() => {
      if (previous) Object.defineProperty(globalThis, "window", previous);
      else Reflect.deleteProperty(globalThis, "window");
    });
    const model = baseModel();
    const hiddenTree = model.tree.map((node) =>
      node.kind === "folder" && node.path === "product"
        ? {
            ...node,
            children: node.children.map((child) =>
              child.path === "product/browse"
                ? { ...child, hidden: true as const }
                : child,
            ),
          }
        : node,
    );
    const hidden = { ...model, tree: hiddenTree };
    const initial = initialState(hidden, "/");
    for (const filters of [
      {},
      { search: "zzz", tags: ["forms"] },
      { view: "changes" as const, search: "zzz" },
    ]) {
      const filtered = withFilterSelection(initial, {
        ...initial.selection,
        ...filters,
      });
      const { proposals, state, store } = harness(hidden, filtered, {
        embedded,
      });
      store.revealFolder("specs", "product/browse");
      assert.equal(state(), filtered);
      assert.equal(state().revealedFolder, undefined);
      assert.deepEqual(proposals, []);
      assert.equal(saved.size, 0);
    }
  });
}
