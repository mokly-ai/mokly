/**
 * The registered Button's `iconOnly`: the icon alone in the package's own
 * square box, named by the label, which the element around the Button gives
 * as its tooltip. A Button without the form draws its label as before.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { parseFragment } from "parse5";

import { buttonInput } from "../components/button";

import { attribute, elements, textContent } from "./design-site-test-helpers";
import type { Element } from "./design-site-test-helpers";
import { wrapperMarkup } from "./wrapper-markup";

const context = { viewport: "desktop", colorScheme: "light" } as const;

type ButtonProps = Parameters<typeof buttonInput.render>[0];

/** The one registered button the props draw, read back from its markup. */
function drawn(props: ButtonProps): Element {
  const html = wrapperMarkup(buttonInput.render(props, context), context);
  const [button, ...more] = elements(parseFragment(html), (element) =>
    /^firna-button-/.test(attribute(element, "data-testid") ?? ""),
  );
  assert.ok(button);
  assert.equal(more.length, 0);
  return button;
}

/** The visible words of each text element inside the button. */
function words(button: Element): string[] {
  return elements(
    button,
    (element) => attribute(element, "dir") === "auto",
  ).map(textContent);
}

/** The element directly around the button. */
function holder(button: Element): Element {
  const parent = button.parentNode;
  assert.ok(parent && "tagName" in parent);
  return parent;
}

test("an icon-only Button draws its icon alone, named and titled by its label", () => {
  const button = drawn({
    label: "History",
    tone: "quiet",
    size: "sm",
    icon: "history",
    iconOnly: true,
  });
  assert.deepEqual(words(button), []);
  assert.equal(
    elements(button, (element) => element.tagName === "svg").length,
    1,
  );
  assert.equal(attribute(button, "aria-label"), "History");
  // The tooltip's holder takes no box, so the Button keeps its own place.
  const around = holder(button);
  assert.equal(around.tagName, "span");
  assert.equal(attribute(around, "title"), "History");
  assert.equal(attribute(around, "style"), "display:contents");
});

test("a caller's accessible name names and titles an icon-only Button", () => {
  const button = drawn({
    label: "Settings",
    accessibilityLabel: "Workspace settings",
    tone: "quiet",
    size: "sm",
    icon: "settings",
    iconOnly: true,
  });
  assert.deepEqual(words(button), []);
  assert.equal(attribute(button, "aria-label"), "Workspace settings");
  assert.equal(attribute(holder(button), "title"), "Workspace settings");
});

test("a Button without the form draws its label as before", () => {
  const plain = drawn({
    label: "History",
    tone: "quiet",
    size: "sm",
    icon: "history",
  });
  assert.deepEqual(words(plain), ["History"]);
  assert.equal(attribute(plain, "aria-label"), undefined);
  assert.notEqual(holder(plain).tagName, "span");
  // A labelled drawing of a control that switches keeps the holder, with no
  // tooltip, and the form needs an icon.
  for (const props of [
    { icon: "history", iconOnly: false },
    { iconOnly: true },
  ] as const) {
    const button = drawn({
      label: "History",
      tone: "quiet",
      size: "sm",
      ...props,
    });
    assert.deepEqual(words(button), ["History"], JSON.stringify(props));
    assert.equal(attribute(button, "aria-label"), undefined);
    assert.equal(attribute(holder(button), "title"), undefined);
  }
});
