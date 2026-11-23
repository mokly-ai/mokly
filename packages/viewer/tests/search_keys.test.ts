import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";

import { isSearchKey, type SearchKeyEvent } from "../src/shell/search_keys.js";

before(() => GlobalRegistrator.register());
after(() => GlobalRegistrator.unregister());

/** A key pressed on the page with no modifier, unless the case sets one. */
function key(fields: Partial<SearchKeyEvent>): SearchKeyEvent {
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

test("⌘K and Ctrl+K ask for the search, also from a text field", () => {
  const cases: readonly [Partial<SearchKeyEvent>, boolean][] = [
    [{ key: "k", code: "KeyK", metaKey: true }, true],
    [{ key: "k", code: "KeyK", ctrlKey: true }, true],
    [{ key: "K", code: "KeyK", ctrlKey: true }, true],
    // A Cyrillic layout types another letter on the K key.
    [{ key: "л", code: "KeyK", ctrlKey: true }, true],
    // Dvorak types k on the V key, and t on the K key.
    [{ key: "k", code: "KeyV", metaKey: true }, true],
    [{ key: "t", code: "KeyK", metaKey: true }, false],
    [{ key: "k", code: "KeyK" }, false],
    [{ key: "j", code: "KeyJ", ctrlKey: true }, false],
  ];
  for (const [fields, asks] of cases)
    assert.equal(isSearchKey(key(fields)), asks, JSON.stringify(fields));
  for (const markup of ["<input>", "<textarea></textarea>"])
    assert.equal(
      isSearchKey(
        key({ key: "k", code: "KeyK", ctrlKey: true, target: element(markup) }),
      ),
      true,
      markup,
    );
});

test("⌘K and Ctrl+K act on nothing with Shift, Alt, or ⌘ and Ctrl together", () => {
  for (const modifiers of [
    { metaKey: true, shiftKey: true },
    { ctrlKey: true, shiftKey: true },
    { ctrlKey: true, altKey: true },
    { metaKey: true, altKey: true },
    { metaKey: true, ctrlKey: true },
  ])
    assert.equal(
      isSearchKey(key({ key: "k", code: "KeyK", ...modifiers })),
      false,
      JSON.stringify(modifiers),
    );
});

test("/ asks for the search outside a text field, with or without Shift", () => {
  for (const markup of [
    "<button>Fit</button>",
    '<a href="/view/home/">Home</a>',
    '<input type="checkbox">',
  ])
    assert.equal(
      isSearchKey(key({ key: "/", code: "Slash", target: element(markup) })),
      true,
      markup,
    );
  // A German layout types / with Shift+7.
  assert.equal(
    isSearchKey(key({ key: "/", code: "Digit7", shiftKey: true })),
    true,
  );
  for (const modifier of ["metaKey", "ctrlKey", "altKey"] as const)
    assert.equal(
      isSearchKey(key({ key: "/", code: "Slash", [modifier]: true })),
      false,
      modifier,
    );
});

test("/ stays a text field's own", () => {
  for (const markup of [
    "<input>",
    '<input type="search">',
    '<input type="number">',
    "<textarea></textarea>",
    "<select><option>One</option></select>",
    '<div contenteditable="true"></div>',
  ])
    assert.equal(
      isSearchKey(key({ key: "/", code: "Slash", target: element(markup) })),
      false,
      markup,
    );
});

test("a handled key or a key of a composition asks for nothing", () => {
  for (const fields of [{ defaultPrevented: true }, { isComposing: true }]) {
    assert.equal(
      isSearchKey(key({ key: "k", code: "KeyK", ctrlKey: true, ...fields })),
      false,
      JSON.stringify(fields),
    );
    assert.equal(
      isSearchKey(key({ key: "/", code: "Slash", ...fields })),
      false,
      JSON.stringify(fields),
    );
  }
});
