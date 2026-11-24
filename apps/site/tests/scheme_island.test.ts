/**
 * The decisions of the scheme island, which applies the reader's color
 * scheme before the first paint and runs the footer's scheme control, as
 * docs/protocol/cloud/site-chrome.md fixes them. Each case runs the shipped
 * island source against a stub page view; the browser specs cover what needs
 * a real browser.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  type MemoryStorage,
  type Scheme,
  type View,
  type ViewOptions,
  memoryStorage,
  openView,
  throwingStorage,
} from "./helpers/scheme-island.js";

/** The root attribute that the token CSS reads. */
const SCHEME = "data-color-scheme";

/** The root attribute that turns transitions off in the scheme sheet. */
const SWITCHING = "data-scheme-switching";

/**
 * A storage that holds the choice a reader made in an earlier view, written
 * by the island itself, or `held` in its place.
 */
function keptChoice(scheme: Scheme, held?: string): MemoryStorage {
  const storage = memoryStorage();
  const earlier = openView({ storage });
  earlier.insertControl();
  earlier.press(scheme);
  assert.equal(storage.entries.size, 1, "the choice is kept in one entry");
  if (held !== undefined)
    for (const key of storage.entries.keys()) storage.entries.set(key, held);
  return storage;
}

test("this view's parameter, else a kept choice, sets the root's scheme as the island runs", () => {
  const cases: ReadonlyArray<{
    name: string;
    options: ViewOptions;
    scheme: Scheme | undefined;
  }> = [
    { name: "no parameter and no choice", options: {}, scheme: undefined },
    {
      name: "?scheme=dark",
      options: { search: "?scheme=dark" },
      scheme: "dark",
    },
    {
      name: "?scheme=light over a kept Dark",
      options: { search: "?scheme=light", storage: keptChoice("dark") },
      scheme: "light",
    },
    {
      name: "a kept Dark in a light system",
      options: { storage: keptChoice("dark") },
      scheme: "dark",
    },
    {
      name: "a kept Light in a dark system",
      options: { storage: keptChoice("light"), system: "dark" },
      scheme: "light",
    },
    {
      name: "a parameter that names no scheme",
      options: { search: "?scheme=sepia", storage: keptChoice("dark") },
      scheme: "dark",
    },
    {
      name: "a kept value that names no scheme",
      options: { storage: keptChoice("dark", "sepia") },
      scheme: undefined,
    },
    {
      name: "storage that throws",
      options: { storage: throwingStorage() },
      scheme: undefined,
    },
    {
      name: "storage that the browser refuses",
      options: { storage: "unavailable" },
      scheme: undefined,
    },
  ];
  for (const { name, options, scheme } of cases) {
    const view = openView(options);
    assert.equal(view.root.get(SCHEME), scheme, name);
    assert.deepEqual(view.errors, [], name);
  }
});

test("the control's radio of the scheme in use is checked as the parser inserts it", () => {
  const cases: ReadonlyArray<{
    name: string;
    options: ViewOptions;
    checked: Scheme;
  }> = [
    { name: "a light system", options: {}, checked: "light" },
    { name: "a dark system", options: { system: "dark" }, checked: "dark" },
    {
      name: "a kept Dark in a light system",
      options: { storage: keptChoice("dark") },
      checked: "dark",
    },
    {
      name: "?scheme=light in a dark system",
      options: { search: "?scheme=light", system: "dark" },
      checked: "light",
    },
  ];
  for (const { name, options, checked } of cases) {
    const view = openView(options);
    view.insertControl();
    assert.deepEqual(view.checked, [checked], name);
  }
});

test("a choice applies at once and is kept, and the parameter never is", () => {
  const storage = memoryStorage();
  const view = openView({ search: "?scheme=dark", storage });
  view.insertControl();
  assert.deepEqual([...storage.entries], [], "the parameter is not kept");
  view.press("light");
  assert.equal(view.root.get(SCHEME), "light");
  assert.equal(openView({ storage, system: "dark" }).root.get(SCHEME), "light");
});

test("a press on the option in use keeps it, so the page stops following the system", () => {
  const storage = memoryStorage();
  const view = openView({ storage });
  view.insertControl();
  view.press("light");
  view.changeSystem("dark");
  assert.equal(view.root.get(SCHEME), "light");
  assert.deepEqual(view.checked, ["light"]);
  assert.equal(openView({ storage, system: "dark" }).root.get(SCHEME), "light");
});

test("a scheme flip pauses transitions until the next frame has drawn it", () => {
  const flips: ReadonlyArray<readonly [string, (view: View) => void]> = [
    ["a press", (view) => view.press("dark")],
    ["a system change without a choice", (view) => view.changeSystem("dark")],
  ];
  for (const [name, flip] of flips) {
    const view = openView();
    view.insertControl();
    flip(view);
    assert.equal(view.root.has(SWITCHING), true, name);
    view.frame();
    assert.equal(view.root.has(SWITCHING), true, name);
    view.frame();
    assert.equal(view.root.has(SWITCHING), false, name);
  }
});

test("where storage throws, a choice still applies to this view", () => {
  const view = openView({ storage: throwingStorage() });
  view.insertControl();
  view.press("dark");
  assert.equal(view.root.get(SCHEME), "dark");
  assert.deepEqual(view.checked, ["dark"]);
  assert.deepEqual(view.errors, []);
});

test("only with no choice and no parameter does the checked radio follow the system", () => {
  const cases: ReadonlyArray<{
    name: string;
    options: ViewOptions;
    checked: Scheme;
    scheme: Scheme | undefined;
  }> = [
    { name: "no choice", options: {}, checked: "dark", scheme: undefined },
    {
      name: "a kept Light",
      options: { storage: keptChoice("light") },
      checked: "light",
      scheme: "light",
    },
    {
      name: "?scheme=light",
      options: { search: "?scheme=light" },
      checked: "light",
      scheme: "light",
    },
  ];
  for (const { name, options, checked, scheme } of cases) {
    const view = openView(options);
    view.insertControl();
    view.changeSystem("dark");
    assert.deepEqual(view.checked, [checked], name);
    assert.equal(view.root.get(SCHEME), scheme, name);
  }
});

test("a page shown again takes a choice made on another page since", () => {
  const storage = memoryStorage();
  const back = openView({ storage });
  back.insertControl();
  const other = openView({ storage });
  other.insertControl();
  other.press("dark");
  // From the back-forward cache, the page keeps its old root until shown.
  back.show(true);
  assert.equal(back.root.get(SCHEME), "dark");
  assert.deepEqual(back.checked, ["dark"]);
  // Loaded again, the browser can restore the old checked radio.
  const reloaded = openView({ storage });
  reloaded.insertControl();
  reloaded.restoreChecked("light");
  reloaded.show(false);
  assert.deepEqual(reloaded.checked, ["dark"]);
});
