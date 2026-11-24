/**
 * The registered Button's `lead`: a muted lead drawn inside the Button before
 * its label, with a slash between them, so the whole row is one control named
 * by the whole text. A Button without a lead draws the package's own label.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { staticUiTheme } from "@mokly-cloud/tokens/shared-ui-theme";
import { parseFragment } from "parse5";

import { buttonInput } from "../components/button";

import {
  attribute,
  elements,
  label as text,
  textContent,
} from "./design-site-test-helpers";
import type { Element } from "./design-site-test-helpers";
import { wrapperMarkup } from "./wrapper-markup";

const context = { viewport: "desktop", colorScheme: "light" } as const;
const theme = staticUiTheme("light");

/** The one registered button the props draw, read back from its markup. */
function drawn(props: Parameters<typeof buttonInput.render>[0]): Element {
  const html = wrapperMarkup(buttonInput.render(props, context), context);
  const [button, ...more] = elements(parseFragment(html), (element) =>
    /^firna-button-/.test(attribute(element, "data-testid") ?? ""),
  );
  assert.ok(button);
  assert.equal(more.length, 0);
  return button;
}

/** Each text element inside the button: its words and its inline style. */
function texts(button: Element): { words: string; style: string }[] {
  return elements(
    button,
    (element) => attribute(element, "dir") === "auto",
  ).map((element) => ({
    words: textContent(element),
    style: attribute(element, "style") ?? "",
  }));
}

/** A colour as the web runtime writes it inline, from a `#rrggbb` value. */
function inline(hex: string): string {
  const [red, green, blue] = [1, 3, 5].map((at) =>
    Number.parseInt(hex.slice(at, at + 2), 16),
  );
  return `rgba(${red},${green},${blue},1.00)`;
}

test("a lead draws before the label in the muted role, inside one Button named by the whole text", () => {
  const button = drawn({
    label: "Mokly Cloud",
    lead: "Mokly Team",
    tone: "quiet",
    size: "sm",
    chevron: true,
    singleLine: true,
  });
  assert.equal(attribute(button, "aria-label"), "Mokly Team / Mokly Cloud");
  assert.equal(text(button), "Mokly Team / Mokly Cloud");
  const [lead, slash, label, ...more] = texts(button);
  assert.ok(lead && slash && label);
  assert.equal(more.length, 0);
  assert.deepEqual(
    [lead.words, slash.words, label.words],
    ["Mokly Team", " / ", "Mokly Cloud"],
  );
  const muted = "color:" + inline(theme.colors.muted);
  for (const part of [lead, slash]) {
    assert.ok(part.style.includes(muted), part.style);
    assert.ok(part.style.includes("font-weight:400"), part.style);
  }
  assert.ok(label.style.includes("color:" + inline(theme.colors.ink)));
  assert.ok(label.style.includes("font-weight:700"), label.style);
  // The switcher's chevron follows the label, inside the same control.
  assert.equal(
    elements(button, (element) => element.tagName === "svg").length,
    1,
  );
});

test("a given accessible name stays the control's name", () => {
  const button = drawn({
    label: "Mokly Cloud",
    lead: "mokly-team",
    accessibilityLabel: "Mokly Team / Mokly Cloud",
    tone: "quiet",
    size: "sm",
  });
  assert.equal(attribute(button, "aria-label"), "Mokly Team / Mokly Cloud");
  assert.equal(texts(button)[0]?.words, "mokly-team");
});

test("a Button without a lead draws the package's own label", () => {
  const button = drawn({ label: "Mokly Cloud", tone: "quiet", size: "sm" });
  const [only, ...more] = elements(
    button,
    (element) => attribute(element, "dir") === "auto",
  );
  assert.ok(only);
  assert.equal(more.length, 0);
  assert.equal(attribute(only, "class"), "firna-text");
  assert.equal(text(only), "Mokly Cloud");
  assert.equal(attribute(button, "aria-label"), undefined);
});
