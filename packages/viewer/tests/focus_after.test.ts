import assert from "node:assert/strict";
import { test } from "node:test";

import { FocusAfter } from "../src/shell/focus_after.js";

type Name = "heading" | "fields" | "notice";

interface FakeDocument {
  activeElement: unknown;
}

/** The DOM calls the focus rule makes, on one fake document. */
function fakeElement(
  document: FakeDocument,
  options: { focusable?: boolean; field?: HTMLElement | null } = {},
) {
  const element = {
    focused: 0,
    ownerDocument: document,
    hasAttribute: (name: string) =>
      name === "tabindex" && options.focusable === true,
    querySelector: () => options.field ?? null,
    focus() {
      element.focused += 1;
      document.activeElement = element;
    },
  };
  return element as typeof element & HTMLElement;
}

function owner() {
  const document: FakeDocument = { activeElement: undefined };
  const focus = new FocusAfter<Name>("heading");
  const heading = fakeElement(document, { focusable: true });
  focus.ref("heading")(heading);
  return { document, focus, heading };
}

test("a request focuses its element once, after the owner's next commit", () => {
  const { document, focus } = owner();
  const notice = fakeElement(document, { focusable: true });
  focus.ref("notice")(notice);
  focus.commit();
  assert.equal(notice.focused, 0);
  focus.request("notice");
  assert.equal(notice.focused, 0);
  focus.commit();
  focus.commit();
  assert.equal(notice.focused, 1);
});

test("a container focuses its first enabled field, else the fallback", () => {
  const { document, focus, heading } = owner();
  const field = fakeElement(document, { focusable: true });
  focus.ref("fields")(fakeElement(document, { field }));
  focus.request("fields");
  focus.commit();
  assert.equal(field.focused, 1);
  focus.ref("fields")(null);
  focus.ref("fields")(fakeElement(document, { field: null }));
  focus.request("fields");
  focus.commit();
  assert.equal(heading.focused, 1);
});

test("a missing element and a focused element that leaves move focus to the fallback", () => {
  const { document, focus, heading } = owner();
  focus.request("notice");
  focus.commit();
  assert.equal(heading.focused, 1);
  const notice = fakeElement(document, { focusable: true });
  focus.ref("notice")(notice);
  notice.focus();
  focus.ref("notice")(null);
  focus.commit();
  assert.equal(heading.focused, 2);
  const idle = fakeElement(document, { focusable: true });
  focus.ref("notice")(idle);
  focus.ref("notice")(null);
  focus.commit();
  assert.equal(heading.focused, 2);
});

test("each name keeps one ref callback", () => {
  const { focus } = owner();
  assert.equal(focus.ref("fields"), focus.ref("fields"));
  assert.notEqual(focus.ref("fields"), focus.ref("notice"));
});

test("the first field skips hidden and disabled controls of every kind", () => {
  const { document, focus, heading } = owner();
  const control = (
    tag: string,
    state: { hidden?: boolean; disabled?: boolean },
  ) => ({
    tag,
    ...state,
    element: fakeElement(document, { focusable: true }),
  });
  const fields = [
    control("select", { hidden: true }),
    control("input", { disabled: true }),
    control("textarea", { hidden: true }),
    control("select", {}),
  ];
  /** Read each part of the selector: a tag, then `:not([hidden])` and `:not(:disabled)`. */
  const matches = (selector: string, field: (typeof fields)[number]) =>
    selector.split(",").some((part) => {
      const [tag = "", ...rules] = part.trim().split(":not(");
      return (
        tag === field.tag &&
        (!rules.includes("[hidden])") || !field.hidden) &&
        (!rules.includes(":disabled)") || !field.disabled)
      );
    });
  const container = {
    ...fakeElement(document),
    querySelector: (selector: string) =>
      fields.find((field) => matches(selector, field))?.element ?? null,
  } as unknown as HTMLElement;
  focus.ref("fields")(container);
  focus.request("fields");
  focus.commit();
  assert.equal(fields[3]!.element.focused, 1);
  assert.equal(heading.focused, 0);
  assert.ok(fields.slice(0, 3).every(({ element }) => element.focused === 0));
});
