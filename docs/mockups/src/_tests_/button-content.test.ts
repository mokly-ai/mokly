/**
 * The registered Button's `content` slot: parts the Button draws inside
 * itself through the package's own content, so one control can draw them in
 * more than one face, named by its label. The icon-only form and a busy
 * Button's working word take the place of the parts.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { parseFragment } from "parse5";
import { createElement } from "react";

import { buttonInput } from "../components/button";

import {
  attribute,
  byClass,
  elements,
  label,
} from "./design-site-test-helpers";
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

/** Parts in two faces: a reference in mono beside its state's phrase. */
const parts = createElement(
  "span",
  { className: "test-parts" },
  createElement("code", null, "main"),
  createElement("span", null, "Ready · 15 Sep"),
);

/** The package's own label text inside the button, if it draws one. */
function packageLabels(button: Element): string[] {
  return elements(button, (element) => attribute(element, "dir") === "auto")
    .filter((element) => attribute(element, "class") === "firna-text")
    .map(label);
}

test("content draws inside one Button, in place of its label, and the label names it", () => {
  const button = drawn({
    label: "main, Ready · 15 Sep",
    tone: "quiet",
    size: "sm",
    content: parts,
  });
  assert.equal(attribute(button, "aria-label"), "main, Ready · 15 Sep");
  assert.equal(byClass(button, "test-parts").length, 1);
  assert.equal(label(button), "mainReady · 15 Sep");
  assert.deepEqual(packageLabels(button), []);
});

test("a caller's accessible name names a Button with content", () => {
  const button = drawn({
    label: "main",
    accessibilityLabel: "main, Ready · 15 Sep",
    tone: "quiet",
    size: "sm",
    content: parts,
  });
  assert.equal(attribute(button, "aria-label"), "main, Ready · 15 Sep");
  assert.equal(byClass(button, "test-parts").length, 1);
});

test("content takes the place of the lead, the icon and the chevron", () => {
  const button = drawn({
    label: "main",
    lead: "Mokly Team",
    icon: "history",
    chevron: true,
    tone: "quiet",
    size: "sm",
    content: parts,
  });
  assert.equal(attribute(button, "aria-label"), "main");
  assert.equal(label(button), "mainReady · 15 Sep");
  assert.equal(
    elements(button, (element) => element.tagName === "svg").length,
    0,
  );
});

test("the icon-only form and a working word take the place of content", () => {
  const glyph = drawn({
    label: "History",
    icon: "history",
    iconOnly: true,
    tone: "quiet",
    size: "sm",
    content: parts,
  });
  assert.equal(byClass(glyph, "test-parts").length, 0);
  assert.equal(attribute(glyph, "aria-label"), "History");
  const busy = drawn({
    label: "Publishing",
    tone: "secondary",
    size: "sm",
    busy: true,
    content: parts,
  });
  assert.equal(byClass(busy, "test-parts").length, 0);
  assert.deepEqual(packageLabels(busy), ["Publishing"]);
});
