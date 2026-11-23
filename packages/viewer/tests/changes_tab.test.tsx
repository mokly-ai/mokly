import assert from "node:assert/strict";
import test from "node:test";

import type { ReactNode } from "react";

import { ChangesStartProvider } from "../src/shell/changes_start.js";
import { ChangesTab, comparedOutcome } from "../src/shell/changes_tab.js";
import { useCompareModes } from "../src/shell/compare_modes.js";
import type { CanvasComparisonController } from "../src/shell/comparison_compared_frame.js";
import { useShellRoot, type ShellElements } from "../src/shell/root_context.js";
import { routeHref } from "../src/shell/routes.js";
import type { ComparisonGenerations } from "../src/shell/use_comparison.js";
import type { EntryStatus } from "../src/shell/view_status.js";
import type { WorkspaceComparison } from "../src/shell/workspace_comparison.js";

import {
  fakeAdapter,
  ORIGIN,
  registerDom,
  renderInShell,
} from "./canvas_frame_fixture.js";
import { rawIndexFixture } from "./catalogue_v9_fixture.js";

/** A variant set whose own example's row is unmodified. */
const SET = "components/action";
/** A changed saved variant of the set. */
const OUTLINE = "components/action/outline";

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

test("the rail holds an added entry's current version alone while nothing compares, and a removed entry's version before alone", () => {
  // Each case: the shown status, whether a shown row compares, the outcome.
  const cases: readonly [
    EntryStatus | undefined,
    boolean,
    string | undefined,
  ][] = [
    ["Added", false, "added"],
    ["Added", true, undefined],
    ["Removed", false, "removed"],
    ["Removed", true, "removed"],
    ["Changed", true, undefined],
    ["Unmodified", false, undefined],
    [undefined, false, undefined],
  ];
  for (const [status, compares, outcome] of cases)
    assert.equal(
      comparedOutcome(status, compares),
      outcome,
      `${String(status)}, compares: ${String(compares)}`,
    );
});

test("a set's added row names both versions while another shown row compares, and its added line while none does", (t) => {
  registerDom(t);
  const { adapter } = fakeAdapter();
  // A variant set opened on its added row, as the Card set opened on Fresh.
  const path = "components/action/default";
  const rail = (compares: boolean) => {
    const view = renderInShell(
      adapter,
      path,
      <ChangesTab
        compares={compares}
        details={<p>Rendered content changed.</p>}
        path={path}
        status="Added"
      />,
    );
    const lines = [
      ...view.container.querySelectorAll(
        ".mbk-compared-version, .mbk-compared-note",
      ),
    ].map((line) => line.textContent);
    view.unmount();
    return lines;
  };
  assert.deepEqual(rail(true), [
    "Before Branch point on main",
    "Current This branch",
  ]);
  assert.deepEqual(rail(false), [
    "Current This branch",
    "Added on this branch, so there is no base to compare.",
  ]);
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

/**
 * The set's compare in Overlay, whose routed row has no generation, with the
 * generations of the rows that compare.
 */
function setComparison(
  generations: ComparisonGenerations | undefined,
): WorkspaceComparison {
  const controller: CanvasComparisonController = {
    busy: false,
    comparedFrame: undefined,
    ...(generations ? { generations } : {}),
    mode: "overlay",
    refresh: () => undefined,
    retry: () => undefined,
    selectMode: () => undefined,
    setComparedFrame: () => undefined,
  };
  return {
    canvas: {
      comparison: controller,
      entryId: SET,
      entryKind: "component",
      frames: [],
      plans: new Map(),
      sideKey: undefined,
    },
    compared: [],
    controller,
    outcomes: [],
  };
}

/** The compare modes that the set's Changes tab holds. */
function SetModes({ generations }: { generations?: ComparisonGenerations }) {
  return useCompareModes({
    compare: setComparison(generations),
    eligible: true,
    removedScreen: false,
    selected: true,
    status: "Unmodified",
  });
}

test("Refresh shows while the comparison holds a row's generation, also when the routed row has none", (t) => {
  registerDom(t);
  const { adapter } = fakeAdapter();
  const refresh = (container: HTMLElement) =>
    container.querySelectorAll('button[aria-label="Refresh comparison"]')
      .length;
  const view = renderInShell(adapter, SET, <SetModes />);
  assert.equal(refresh(view.container), 0, "before any row loaded");
  const loaded = new Map([
    [OUTLINE, { url: `${ORIGIN}/mokly-viewer/diffs/generations/outline/` }],
  ]);
  view.rerender(<SetModes generations={loaded} />);
  assert.equal(refresh(view.container), 1, "once a changed row loaded");
  view.unmount();
});
