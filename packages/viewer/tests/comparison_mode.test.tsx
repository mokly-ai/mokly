import assert from "node:assert/strict";
import test from "node:test";

import { act } from "@testing-library/react";

import type { PanelTab } from "@mokly/ui/panel-tabs";

import { useShellComparisonMode } from "../src/shell/comparison_mode.js";
import type { ComparisonMode } from "../src/shell/comparison_presentation.js";
import { useShellStore } from "../src/shell/store_context.js";
import { useComparison } from "../src/shell/use_comparison.js";

import {
  fakeAdapter,
  registerDom,
  renderInShell,
} from "./canvas_frame_fixture.js";

const HOME = "product/browse/home";

/** What the last render read, and the actions of the reader. */
let read:
  | {
      chosen: ComparisonMode;
      shown: ComparisonMode;
      select(mode: ComparisonMode): void;
      setTab(tab: PanelTab): void;
    }
  | undefined;

/** The workspace's comparison of Home, and the shell's mode beside it. */
function Probe() {
  const store = useShellStore();
  const comparison = useComparison({
    eligible: true,
    eligibilityKnown: true,
    entryId: HOME,
  });
  read = {
    chosen: comparison.mode,
    shown: useShellComparisonMode(),
    select: comparison.selectMode,
    setTab: store.setPanelTab,
  };
  return null;
}

test("the shell's mode, which host markers and the host's pick follow, is the chosen mode while Changes is selected and Current while Inspect is", (t) => {
  registerDom(t);
  // A shell without a host follows the window's address, so it stays on Home.
  window.history.replaceState(null, "", `/view/${HOME}/`);
  const view = renderInShell(fakeAdapter().adapter, HOME, <Probe />);
  const modes = () => [read?.chosen, read?.shown];
  act(() => read?.select("side"));
  assert.deepEqual(modes(), ["side", "current"]);
  act(() => read?.setTab("changes"));
  assert.deepEqual(modes(), ["side", "side"]);
  act(() => read?.setTab("inspect"));
  assert.deepEqual(modes(), ["side", "current"]);
  view.unmount();
});
