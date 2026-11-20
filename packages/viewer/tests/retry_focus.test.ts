import assert from "node:assert/strict";
import { test } from "node:test";

import { RetryFocus } from "../src/shell/retry_focus.js";

interface FakeDocument {
  activeElement: unknown;
  body: unknown;
}

/** One element of a fake document, which counts its focus calls. */
function fakeElement(document: FakeDocument) {
  const element = {
    focused: 0,
    ownerDocument: document,
    focus() {
      element.focused += 1;
      document.activeElement = element;
    },
  };
  return element as typeof element & HTMLElement;
}

/** A failed state whose focused Try again the reader presses. */
function pressed() {
  const body = {};
  const document: FakeDocument = { activeElement: body, body };
  const focus = new RetryFocus();
  let retried = 0;
  const button = fakeElement(document);
  button.focus();
  focus.retry(() => (retried += 1))!();
  // React removes the button, so focus falls back to the body.
  document.activeElement = body;
  return { body, document, focus, retried: () => retried };
}

/** React detaches the ref of the status, then removes the status. */
function leave(focus: RetryFocus, document: FakeDocument) {
  focus.status(null);
  document.activeElement = document.body;
}

test("Try again focuses the status, then the first element of the content", () => {
  const { document, focus, retried } = pressed();
  assert.equal(retried(), 1);
  const status = fakeElement(document);
  focus.status(status);
  assert.equal(status.focused, 1);
  leave(focus, document);
  const first = fakeElement(document);
  const second = fakeElement(document);
  focus.content(first);
  focus.content(second);
  assert.deepEqual([first.focused, second.focused], [1, 0]);
  // A later content commit takes no focus.
  document.activeElement = document.body;
  focus.content(first);
  assert.equal(first.focused, 1);
});

test("content that commits while the status shows waits until the status leaves", () => {
  const { document, focus } = pressed();
  focus.status(fakeElement(document));
  const content = fakeElement(document);
  focus.content(content);
  assert.equal(content.focused, 0);
  leave(focus, document);
  focus.content(content);
  assert.equal(content.focused, 1);
});

test("after the reader moved focus during the load, the content takes none", () => {
  const { document, focus } = pressed();
  focus.status(fakeElement(document));
  fakeElement(document).focus();
  // The element that the reader chose leaves too, so focus is on the body.
  document.activeElement = document.body;
  leave(focus, document);
  const content = fakeElement(document);
  focus.content(content);
  assert.equal(content.focused, 0);
});

test("a status and content without Try again take no focus", () => {
  const body = {};
  const document: FakeDocument = { activeElement: body, body };
  const focus = new RetryFocus();
  const status = fakeElement(document);
  focus.status(status);
  leave(focus, document);
  const content = fakeElement(document);
  focus.content(content);
  assert.deepEqual([status.focused, content.focused], [0, 0]);
  assert.equal(focus.retry(undefined), undefined);
});
