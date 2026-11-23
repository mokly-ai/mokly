import assert from "node:assert/strict";
import test from "node:test";

import type { ReactNode } from "react";

import { ChangesStartProvider } from "../src/shell/changes_start.js";
import { ChangesTab, comparedOutcome } from "../src/shell/changes_tab.js";
import { useShellRoot, type ShellElements } from "../src/shell/root_context.js";
import { routeHref } from "../src/shell/routes.js";
import type { EntryStatus } from "../src/shell/view_status.js";

import {
  fakeAdapter,
  registerDom,
  renderInShell,
} from "./canvas_frame_fixture.js";
import { rawIndexFixture } from "./catalogue_v9_fixture.js";

/** The shell's elements, as the last render read them. */
let elements: ShellElements | undefined;

function Probe() {
  elements = useShellRoot()?.elements;
  return null;
}

/** The routed entry's Changes tab, with a host's content in the slot. */
function changesTab(path: string): ReactNode {
  return (
    <ChangesStartProvider content={<button type="button">Re-run check</button>}>
      <ChangesTab
        details={<p>Rendered content changed.</p>}
        modes={<p>Modes</p>}
        path={path}
        status="Changed"
      />
      <Probe />
    </ChangesStartProvider>
  );
}

/** Each part of the tab, by its section's name or else by its text. */
function parts(container: HTMLElement): (string | null)[] {
  const panel = container.querySelector(".mbk-changes");
  assert.ok(panel);
  return [...panel.children].map(
    (part) => part.getAttribute("aria-label") ?? part.textContent,
  );
}

test("the rail holds an added entry's current version alone and a removed entry's version before alone", () => {
  const cases: readonly [EntryStatus | undefined, string | undefined][] = [
    ["Added", "added"],
    ["Removed", "removed"],
    ["Changed", undefined],
    ["Unmodified", undefined],
    [undefined, undefined],
  ];
  for (const [status, outcome] of cases)
    assert.equal(comparedOutcome(status), outcome, String(status));
});

test("the Changes tab holds the stepper of the entry's change, the host's content, Compared, the modes, then the details", (t) => {
  registerDom(t);
  const { adapter } = fakeAdapter();
  const path = "product/browse/home";
  const view = renderInShell(adapter, path, changesTab(path));
  assert.deepEqual(parts(view.container), [
    "Change 3 of 5",
    "Re-run check",
    "Compared",
    "Compare",
    "Rendered content changed.",
  ]);
  // The steps open the entries before and after it in Changes' order: the
  // screen before it, and its removed variant, whose record its snapshot
  // names.
  const snapshot = rawIndexFixture().removedEntries.find(
    ({ entry }) => entry.path === "product/browse/home/retired",
  )?.snapshotId;
  assert.ok(snapshot);
  const step = (name: string) =>
    view.container
      .querySelector(`[aria-label="${name}"]`)
      ?.getAttribute("href");
  assert.equal(step("Previous change"), routeHref("product/browse/details"));
  assert.equal(
    step("Next change"),
    routeHref("product/browse/home/retired", undefined, { snapshot }),
  );
  // The rail names the index's base, and the shell leaves the host's slot
  // content to the host.
  assert.deepEqual(
    [...view.container.querySelectorAll(".mbk-compared-version")].map(
      (version) => version.textContent,
    ),
    ["Before Branch point on main", "Current This branch"],
  );
  const host = view.container.querySelector(
    '[data-mokly-slot="changesStart"] > button',
  );
  const previous = view.container.querySelector(
    '[aria-label="Previous change"]',
  );
  assert.ok(host && previous && elements);
  assert.deepEqual(
    [elements.inHostSlot(host), elements.inHostSlot(previous)],
    [true, false],
  );
  view.unmount();
});

test("an entry that the Changes filter does not list has no stepper", (t) => {
  registerDom(t);
  const { adapter } = fakeAdapter();
  const view = renderInShell(adapter, "guide", changesTab("guide"));
  assert.deepEqual(parts(view.container), [
    "Re-run check",
    "Compared",
    "Compare",
    "Rendered content changed.",
  ]);
  view.unmount();
});
