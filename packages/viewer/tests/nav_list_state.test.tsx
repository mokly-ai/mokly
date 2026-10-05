import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { CatalogueNav } from "../src/shell/nav.js";
import { shellRecoverySnapshot } from "../src/shell/store_actions.js";
import { ShellStoreBoundary } from "../src/shell/store_context.js";
import { withFilterSelection } from "../src/shell/store_filters.js";
import { createInitialShellState } from "../src/shell/store_initial.js";
import { viewerCatalogue, viewerContext } from "../src/viewer/projection.js";
import type { ViewerSelection } from "../src/viewer/types.js";

import {
  baseModel,
  initialState,
  variantKey,
  withRemovedVariant,
} from "./disclosure_evidence_fixture.js";
import { fakeStorage, harness } from "./navigation_store_fixture.js";
import { model } from "./shell_state_fixture.js";

const parentTaggedModel = {
  ...model,
  screens: model.screens.map((entry) =>
    entry.variantOf ? { ...entry, tags: [] } : entry,
  ),
};

type Harness = ReturnType<typeof harness>;

function markup(subject: Harness): string {
  const store = { ...subject.store, state: subject.state() };
  return renderToStaticMarkup(
    <ShellStoreBoundary value={store}>
      <CatalogueNav catalogue={store.catalogue} context={store.context} />
    </ShellStoreBoundary>,
  );
}

function expanded(subject: Harness, open: boolean): void {
  const html = markup(subject);
  assert.match(
    html,
    new RegExp(
      `aria-expanded="${open}" aria-label="${open ? "Hide" : "Show"} variants of Home"`,
    ),
  );
  assert.match(
    html,
    new RegExp(
      `data-nav-disclosure="${variantKey}" data-nav-variants=""${open ? " id=" : " hidden="}`,
    ),
  );
}

for (const [name, filters] of [
  ["All", {}],
  ["search", { search: "empty" }],
  ["Changes", { view: "changes" }],
] as const satisfies readonly (readonly [string, Partial<ViewerSelection>])[]) {
  test(`${name}: Hide, Show, and Collapse all use the current list value`, (context) => {
    fakeStorage(context);
    const initial = initialState(model, "/");
    const filtered = withFilterSelection(initial, {
      ...initial.selection,
      ...filters,
    });
    const subject = harness(model, filtered, {
      changedEntries: ["product/browse/home/empty"],
    });
    subject.store.setDisclosure(variantKey, true);
    expanded(subject, true);
    subject.store.setDisclosure(variantKey, false);
    expanded(subject, false);
    subject.store.setDisclosure(variantKey, true);
    expanded(subject, true);
    subject.store.collapseAll();
    expanded(subject, false);
    assert.ok(
      Object.values(subject.state().disclosures).every((value) => !value),
    );
  });

  test(`${name}: watched reload retains a closed unrelated list`, (context) => {
    fakeStorage(context);
    const initial = initialState(model, "/");
    const filtered = withFilterSelection(initial, {
      ...initial.selection,
      ...filters,
    });
    const subject = harness(model, filtered, {
      changedEntries: ["product/browse/home/empty"],
    });
    subject.store.setDisclosure(variantKey, false);
    const restored = createInitialShellState(
      subject.store.catalogue,
      subject.store.context,
      initial.route.view,
      { recovery: shellRecoverySnapshot(subject.state(), false) },
    );
    expanded(
      harness(model, restored, {
        changedEntries: ["product/browse/home/empty"],
      }),
      false,
    );
  });
}

test("each filter edit opens every list key, and display edits keep a closed list closed", (context) => {
  fakeStorage(context);
  const initial = initialState(model, "/");
  const subject = harness(
    model,
    withFilterSelection(initial, { ...initial.selection, search: "empty" }),
  );
  assert.equal(subject.state().disclosures[variantKey], true);
  subject.store.setDisclosure(variantKey, false);
  const displayed = withFilterSelection(subject.state(), {
    ...subject.state().selection,
    viewport: "mobile",
  });
  assert.equal(displayed.disclosures[variantKey], false);
  const edited = withFilterSelection(displayed, {
    ...displayed.selection,
    search: "home",
  });
  assert.ok(Object.values(edited.disclosures).every(Boolean));
});

for (const [name, filters, value] of [
  ["All with only a removed variant", {}, withRemovedVariant(baseModel(), 2)],
  ["search matching only the parent", { tags: ["landing"] }, parentTaggedModel],
  ["Changes matching only the parent", { view: "changes" }, model],
] as const) {
  test(`${name}: a list without matching rows has no button`, (context) => {
    fakeStorage(context);
    const initial = initialState(value, "/");
    const subject = harness(
      value,
      withFilterSelection(initial, { ...initial.selection, ...filters }),
      { changedEntries: ["product/browse/home"] },
    );
    const html = markup(subject);
    assert.doesNotMatch(html, /aria-label="(?:Show|Hide) variants of Home"/);
    assert.match(html, /data-entry-id="product\/browse\/home"/);
  });
}

test("server rows have no button for a list containing only a removed variant", () => {
  const value = withRemovedVariant(baseModel(), 2);
  const catalogue = viewerCatalogue(value);
  const context = viewerContext(value, initialState(value, "/").selection);
  assert.doesNotMatch(
    renderToStaticMarkup(
      <CatalogueNav catalogue={catalogue} context={context} />,
    ),
    /aria-label="(?:Show|Hide) variants of Home"/,
  );
});
