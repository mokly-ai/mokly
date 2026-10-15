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
