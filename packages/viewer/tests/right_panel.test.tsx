import assert from "node:assert/strict";
import test from "node:test";

import { act, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";

import { EntryRightPanel } from "../src/shell/right_panel.js";
import { useShellStore } from "../src/shell/store_context.js";

import {
  fakeAdapter,
  registerDom,
  renderInShell,
} from "./canvas_frame_fixture.js";

/** The selected tab that the store holds, as the last render read it. */
let stored: string | undefined;

function Probe() {
  stored = useShellStore().state.panelTab;
  return null;
}

/** The right panel of one entry, with or without Changes. */
function panel(changes: boolean, settled: boolean): ReactNode {
  return (
    <>
      <EntryRightPanel
        changes={changes ? <p>Comparison</p> : undefined}
        inspect={<p>Details</p>}
        settled={settled}
      />
      <Probe />
    </>
  );
}

/** The labels of the tabs, and the text of the body that shows. */
function shown(container: HTMLElement) {
  const tabs = [...container.querySelectorAll('[role="tab"]')];
  const bodies = [...container.querySelectorAll('[role="tabpanel"]')];
  return {
    selected: tabs
      .filter((tab) => tab.getAttribute("aria-selected") === "true")
      .map((tab) => tab.textContent),
    tabs: tabs.map((tab) => tab.textContent),
    visible: bodies
      .filter((body) => !body.hasAttribute("hidden"))
      .map((body) => body.textContent),
  };
}

test("the selected tab survives while the shell does not know an entry's Changes, and Inspect returns once it knows the entry has none", async (t) => {
  registerDom(t);
  const { adapter } = fakeAdapter();
  const view = renderInShell(adapter, "product/browse/home", panel(true, true));
  assert.deepEqual(shown(view.container), {
    selected: ["Inspect"],
    tabs: ["Inspect", "Changes"],
    visible: ["Details"],
  });
  const changes = [...view.container.querySelectorAll('[role="tab"]')].find(
    (tab) => tab.textContent === "Changes",
  );
  assert.ok(changes);
  act(() => {
    fireEvent.click(changes);
  });
  assert.deepEqual(shown(view.container).visible, ["Comparison"]);
  assert.equal(stored, "changes");

  // Until the shell knows, an entry without Changes shows Inspect and keeps
  // the stored tab, so an entry with Changes opens on Changes again.
  view.rerender(panel(false, false));
  assert.deepEqual(shown(view.container), {
    selected: ["Inspect"],
    tabs: ["Inspect"],
    visible: ["Details"],
  });
  assert.equal(stored, "changes");
  view.rerender(panel(true, true));
  assert.deepEqual(shown(view.container).selected, ["Changes"]);

  // Once the shell knows that the entry has none, Inspect is selected.
  await act(async () => view.rerender(panel(false, true)));
  assert.equal(stored, "inspect");
  view.rerender(panel(true, true));
  assert.deepEqual(shown(view.container).selected, ["Inspect"]);
  view.unmount();
});
