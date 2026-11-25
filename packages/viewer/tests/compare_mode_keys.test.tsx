import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

import {
  compareModeKey,
  useCompareModeKeys,
  type ModeKeyEvent,
} from "../src/shell/compare_mode_keys.js";
import { catalogueNavSections } from "../src/shell/nav_model.js";
import { ShellRootProvider, useShellRoot } from "../src/shell/root_context.js";
import { shellStore } from "../src/shell/store_actions.js";
import { ShellStoreBoundary } from "../src/shell/store_context.js";
import { createInitialShellState } from "../src/shell/store_initial.js";

import { unregisterDom } from "./dom_teardown.js";
import { catalogue, context } from "./shell_state_fixture.js";

before(() => GlobalRegistrator.register());
after(unregisterDom);

/** The compare modes in key order: Current is 1 and Swipe is 5. */
const MODES = ["current", "side", "overlay", "difference", "swipe"] as const;
type Mode = (typeof MODES)[number];

/** A key pressed on the page with no modifier, unless the case sets one. */
function key(fields: Partial<ModeKeyEvent>): ModeKeyEvent {
  return {
    altKey: false,
    code: "",
    ctrlKey: false,
    defaultPrevented: false,
    isComposing: false,
    key: "",
    metaKey: false,
    shiftKey: false,
    target: document.body,
    ...fields,
  };
}

/** The first element of some markup, placed in the page. */
function element(markup: string): Element {
  const holder = document.createElement("div");
  holder.innerHTML = markup;
  document.body.append(holder);
  const first = holder.firstElementChild;
  assert.ok(first);
  return first;
}

test("keys 1 to 5 select the five modes in order, as the layout types the digit, the number pad's included", () => {
  const cases: readonly [Partial<ModeKeyEvent>, Mode][] = [
    [{ key: "1", code: "Digit1" }, "current"],
    [{ key: "2", code: "Digit2" }, "side"],
    [{ key: "3", code: "Digit3" }, "overlay"],
    [{ key: "4", code: "Digit4" }, "difference"],
    [{ key: "5", code: "Digit5" }, "swipe"],
    [{ key: "4", code: "Numpad4" }, "difference"],
    // A French layout types the digits with Shift.
    [{ key: "2", code: "Digit2", shiftKey: true }, "side"],
  ];
  for (const [fields, mode] of cases)
    assert.equal(
      compareModeKey(key(fields), MODES, MODES),
      mode,
      JSON.stringify(fields),
    );
});

test("a key selects only an offered mode, at its own place in the key order", () => {
  const offered: readonly Mode[] = ["current", "overlay"];
  assert.equal(
    compareModeKey(key({ key: "2", code: "Digit2" }), MODES, offered),
    undefined,
  );
  assert.equal(
    compareModeKey(key({ key: "3", code: "Digit3" }), MODES, offered),
    "overlay",
  );
});

test("a key in a text field, with ⌘, Ctrl or Alt, during a composition, or after another listener handled it selects nothing", () => {
  const two = { key: "2", code: "Digit2" };
  for (const markup of [
    "<input>",
    "<textarea></textarea>",
    "<select><option>One</option></select>",
    '<div contenteditable="true"></div>',
  ])
    assert.equal(
      compareModeKey(key({ ...two, target: element(markup) }), MODES, MODES),
      undefined,
      markup,
    );
  assert.equal(
    compareModeKey(
      key({ ...two, target: element("<button>Overlay</button>") }),
      MODES,
      MODES,
    ),
    "side",
  );
  for (const fields of [
    { metaKey: true },
    { ctrlKey: true },
    { altKey: true },
    { isComposing: true },
    { defaultPrevented: true },
  ])
    assert.equal(
      compareModeKey(key({ ...two, ...fields }), MODES, MODES),
      undefined,
      JSON.stringify(fields),
    );
});

test("Shift+1 stays the canvas's Fit on a layout that types 1 with Shift", () => {
  assert.equal(
    compareModeKey(
      key({ key: "1", code: "Digit1", shiftKey: true }),
      MODES,
      MODES,
    ),
    undefined,
  );
});

test("a key that types no mode's digit selects nothing", () => {
  for (const fields of [
    { key: "a", code: "KeyA" },
    { key: "0", code: "Digit0" },
    { key: "6", code: "Digit6" },
    // A French layout types & on the 1 key without Shift.
    { key: "&", code: "Digit1" },
    { key: "Enter", code: "Enter" },
  ])
    assert.equal(
      compareModeKey(key(fields), MODES, MODES),
      undefined,
      JSON.stringify(fields),
    );
});

/** The root element of a shell, which its layout attaches. */
function ShellRoot({ children }: { children: ReactNode }) {
  return <div ref={useShellRoot()?.ref}>{children}</div>;
}

/** A Changes tab's mode keys. */
function ModeKeys(props: {
  enabled: boolean;
  offered: readonly Mode[];
  onMode: (mode: Mode) => void;
}) {
  useCompareModeKeys({ ...props, modes: MODES });
  return null;
}

/** The interactive store of a standalone shell. */
function standaloneStore() {
  const state = createInitialShellState(
    catalogue,
    context,
    { view: { kind: "home" } },
    undefined,
  );
  return shellStore({
    catalogue,
    context,
    embedded: false,
    interactive: true,
    navigation: {
      navigateFrame() {},
      onShellClick() {},
      onShellKeyDown() {},
      openFrame() {},
    },
    propose() {},
    sections: catalogueNavSections(catalogue),
    setState() {},
    state,
    stateRef: { current: state },
  });
}

test("a mode key anywhere on a standalone shell's document selects the latest offered mode and loses its default, but not while the keys are off", () => {
  const store = standaloneStore();
  const selected: Mode[] = [];
  const shell = (enabled: boolean, offered: readonly Mode[]) => (
    <ShellStoreBoundary value={store}>
      <ShellRootProvider>
        <ShellRoot>
          <ModeKeys
            enabled={enabled}
            offered={offered}
            onMode={(mode) => selected.push(mode)}
          />
        </ShellRoot>
      </ShellRootProvider>
    </ShellStoreBoundary>
  );
  /** Press a digit on the page outside the shell, and say if it acted. */
  const press = (digit: string): boolean => {
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code: `Digit${digit}`,
      key: digit,
    });
    document.body.dispatchEvent(event);
    return event.defaultPrevented;
  };
  const view = render(shell(true, ["current", "side"]));
  try {
    assert.equal(press("2"), true);
    assert.equal(press("3"), false);
    view.rerender(shell(true, ["current", "side", "overlay"]));
    assert.equal(press("3"), true);
    view.rerender(shell(false, MODES));
    assert.equal(press("4"), false);
    assert.deepEqual(selected, ["side", "overlay"]);
  } finally {
    view.unmount();
  }
});
