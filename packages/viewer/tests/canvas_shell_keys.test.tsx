import assert from "node:assert/strict";
import test from "node:test";

import { act } from "@testing-library/react";
import type { ReactNode, RefObject } from "react";

import type { TopBarHandle } from "@mokly/ui/top-bar";

import { DESKTOP_FRAME_SIZE } from "../src/shell/canvas_frame_size.js";
import type { CanvasFramePlan } from "../src/shell/canvas_frames.js";
import { CanvasLiveFrame } from "../src/shell/canvas_live_frame.js";
import {
  useOptionalShellFrameRegistry,
  type ShellFrameRegistry,
} from "../src/shell/frame_registry.js";
import { useShellRoot } from "../src/shell/root_context.js";
import { useSearchKeys } from "../src/shell/search_keys.js";
import {
  useCanvasSelection,
  useCanvasSelectionState,
  type WorkspaceCanvasSelection,
} from "../src/shell/use_canvas_selection.js";

import {
  canvasPlans,
  fakeAdapter,
  registerDom,
  renderInShell,
} from "./canvas_frame_fixture.js";
import { flush } from "./data_fakes.js";

/**
 * The root of an embedded shell, which hears the shell's keys, and a frame
 * inside it, whose document forwards its keys through the fake adapter.
 */
function Root({
  children,
  plan,
}: {
  children: ReactNode;
  plan: CanvasFramePlan;
}) {
  const root = useShellRoot();
  return (
    <div ref={root?.ref}>
      <CanvasLiveFrame
        hasDarkFragments={false}
        plan={plan}
        size={DESKTOP_FRAME_SIZE}
      />
      {children}
    </div>
  );
}

/** What the test reads of the shell after each step. */
interface Seen {
  registry?: ShellFrameRegistry | undefined;
  selection?: WorkspaceCanvasSelection;
}

/** The canvas selection of the Action's variant set, as its workspace holds it. */
function Selection({
  plans,
  selecting,
  seen,
}: {
  plans: readonly CanvasFramePlan[];
  selecting: boolean;
  seen: Seen;
}) {
  const [state, dispatch] = useCanvasSelectionState(undefined);
  seen.registry = useOptionalShellFrameRegistry();
  seen.selection = useCanvasSelection({
    dispatch,
    plans,
    routed: {
      compact: false,
      path: "components/action",
      savedVariant: false,
      scheme: "light",
    },
    selecting: () => selecting,
    set: true,
    state,
  });
  return null;
}

/** The top bar's search keys, for a bar that the test gives. */
function SearchKeys({ bar }: { bar: RefObject<TopBarHandle | null> }) {
  useSearchKeys(bar);
  return null;
}

test("Escape from inside a frame clears the canvas selection in Inspect, and Highlight components, a host pick and Changes keep it", async (t) => {
  registerDom(t);
  const plans = canvasPlans("components/action").slice(0, 1);
  const [plan] = plans;
  assert.ok(plan);
  const { adapter, mounts } = fakeAdapter();
  const seen: Seen = {};
  const node = (selecting: boolean) => (
    <Root plan={plan}>
      <Selection plans={plans} selecting={selecting} seen={seen} />
    </Root>
  );
  const view = renderInShell(adapter, plan.entry.path, node(true));
  const escape = () =>
    act(() => mounts[0]!.onEvent!({ type: "canvas-key", key: "escape" }));
  try {
    await act(flush);
    const selected = { kind: "frame", frame: plan.key };
    act(() => seen.selection!.selectFrame(plan.key));
    assert.deepEqual(seen.selection!.state.selected, selected);
    // Escape ends Highlight components or a host pick first.
    const inspection = seen.registry!.inspection;
    for (const kind of ["workspace", "pick"] as const) {
      const claim = inspection.claim(kind);
      escape();
      inspection.release(claim);
      assert.deepEqual(seen.selection!.state.selected, selected, kind);
    }
    // Changes selects nothing, and its Escape keeps Inspect's selection.
    view.rerender(node(false));
    escape();
    assert.deepEqual(seen.selection!.state.selected, selected, "Changes");
    view.rerender(node(true));
    escape();
    assert.equal(seen.selection!.state.selected, undefined);
  } finally {
    view.unmount();
  }
});

test("a search key from inside a frame moves focus to the search field, and Escape does not", async (t) => {
  registerDom(t);
  const [plan] = canvasPlans("product/browse/home");
  assert.ok(plan);
  const { adapter, mounts } = fakeAdapter();
  const requests: string[] = [];
  const bar = { current: { focusSearch: () => requests.push("search") } };
  const view = renderInShell(
    adapter,
    plan.entry.path,
    <Root plan={plan}>
      <SearchKeys bar={bar} />
    </Root>,
  );
  try {
    await act(flush);
    for (const key of ["escape", "search"] as const)
      act(() => mounts[0]!.onEvent!({ type: "canvas-key", key }));
    assert.deepEqual(requests, ["search"]);
  } finally {
    view.unmount();
  }
});
