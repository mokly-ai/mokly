/**
 * The variants of the documentation screen: Your first screen, whose first
 * code block is the HTML sample fence with a dimmed code line, in its Mobile
 * view and in its Desktop view, and the mobile tree sheet.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  composite,
  contrast,
  cssColour,
  declared,
  one,
  siteRules,
  tags,
  type Rgb,
} from "./design-site-docs-helpers";
import {
  attribute,
  byClass,
  childElements,
  elements,
  label,
  siteDocument,
  siteEntry,
  type Element,
} from "./design-site-test-helpers";

test("the documentation variants keep the shared landmarks in both schemes", () => {
  for (const id of [
    "design/site/docs/first-screen",
    "design/site/docs/first-screen-desktop",
    "design/site/docs/layers",
  ]) {
    const entry = siteEntry(id);
    assert.equal(entry.kind, "screen", id);
    assert.equal(
      entry.kind === "screen" && entry.variantOf,
      "design/site/docs",
    );
    for (const viewport of ["mobile", "desktop"] as const)
      for (const scheme of ["light", "dark"] as const) {
        const { document } = siteDocument(id, viewport, scheme);
        const at = `${id} ${viewport} ${scheme}`;
        assert.equal(tags(document, "h1").length, 1, at);
        assert.deepEqual(
          tags(document, "main").map((node) => attribute(node, "id")),
          ["main"],
          at,
        );
        assert.equal(tags(document, "a")[0], one(document, "site-skip"), at);
        assert.equal(byClass(document, "site-footer").length, 1, at);
        const docs = tags(one(document, "site-header"), "a").filter(
          (node) => attribute(node, "aria-current") === "page",
        );
        assert.deepEqual(docs.map(label), ["Docs"], at);
      }
  }
});

/** Each radio of a control: its value, whether it is chosen, and its name. */
function radios(control: Element) {
  return byClass(control, "site-docs-sample-option").map((option) => [
    attribute(tags(option, "input")[0]!, "value"),
    attribute(tags(option, "input")[0]!, "checked") !== undefined,
    label(option),
  ]);
}

/** The shapes of an icon's drawing, without the size of its `svg`. */
function drawing(icon: Element) {
  return elements(icon, () => true)
    .slice(1)
    .map((node) => [node.tagName, node.attrs]);
}

/**
 * The two views of the sample band. Each lights and wires the heading's line,
 * and each leaves out the other viewport's paragraph: that line is dimmed,
 * and the body shows the view's own navigation line.
 */
const SAMPLE_VIEWS = [
  {
    body: ["Your workspace is ready.", "Compact navigation"],
    dimmed: [15],
    entry: "design/site/docs/first-screen",
    name: "Mobile",
    size: "390 × 844",
    viewports: [
      ["mobile", true, "Mobile"],
      ["desktop", false, "Desktop"],
    ],
  },
  {
    body: ["Your workspace is ready.", "Full navigation"],
    dimmed: [14],
    entry: "design/site/docs/first-screen-desktop",
    name: "Desktop",
    size: "1280 × 800",
    viewports: [
      ["mobile", false, "Mobile"],
      ["desktop", true, "Desktop"],
    ],
  },
] as const;

for (const viewport of ["mobile", "desktop"] as const)
  for (const view of SAMPLE_VIEWS)
    test(`${viewport}: Your first screen renders its HTML sample beside its code in the ${view.name} view`, () => {
      const { document } = siteDocument(view.entry, viewport);
      const sample = one(document, "site-docs-sample");
      const section = tags(one(document, "site-document-body"), "section")[0]!;
      assert.equal(
        attribute(tags(section, "h2")[0]!, "id"),
        "add-one-html-file",
      );
      assert.equal(
        childElements(section).indexOf(sample),
        3,
        "after the first paragraph",
      );
      const head = one(sample, "site-docs-sample-head");
      assert.equal(attribute(head, "aria-hidden"), "true");
      assert.deepEqual(childElements(head).map(label), ["Welcome", "welcome"]);
      const code = one(sample, "site-code");
      assert.deepEqual(byClass(code, "site-code-tab").map(label), [
        "welcome.screen.html",
      ]);
      assert.equal(label(one(code, "site-code-language")), "html");
      const lines = byClass(code, "site-code-line");
      const marked = (kind: string) =>
        lines.flatMap((line, index) =>
          attribute(line, "class")?.split(" ").includes(kind)
            ? [index + 1]
            : [],
        );
      // The drawing shows Welcome: the heading's line is wired, and the
      // paragraph that the chosen view leaves out is dimmed.
      assert.deepEqual(marked("site-code-line--lit"), [12]);
      assert.deepEqual(marked("site-code-line--dim"), view.dimmed);
      const controls = byClass(sample, "site-docs-sample-control");
      assert.deepEqual(
        controls.map((node) => [node.tagName, attribute(node, "aria-label")]),
        [
          ["fieldset", "Viewport"],
          ["fieldset", "Saved state"],
        ],
      );
      assert.deepEqual(controls.map(radios), [
        view.viewports,
        [
          ["welcome", true, "Welcome"],
          ["first-visit", false, "First visit"],
        ],
      ]);
      const stage = one(sample, "site-docs-sample-stage");
      assert.equal(attribute(stage, "aria-hidden"), "true");
      assert.equal(
        elements(stage, (node) =>
          ["a", "button", "input"].includes(node.tagName),
        ).length,
        0,
      );
      // The frame's label names the checked viewport with its option's icon.
      const frameName = one(stage, "site-frame-name");
      assert.equal(label(frameName), view.name);
      const checked = byClass(controls[0]!, "site-docs-sample-option").filter(
        (option) =>
          attribute(tags(option, "input")[0]!, "checked") !== undefined,
      );
      assert.equal(checked.length, 1);
      assert.deepEqual(
        drawing(tags(frameName, "svg")[0]!),
        drawing(tags(checked[0]!, "svg")[0]!),
      );
      assert.equal(label(one(stage, "site-sel-size")), view.size);
      assert.equal(
        label(one(stage, "site-docs-sample-pick")),
        "Welcome, Adah1",
      );
      assert.deepEqual(
        byClass(stage, "site-docs-sample-text").map(label),
        view.body,
      );
      assert.equal(
        byClass(stage, "site-docs-sample-wire").length,
        viewport === "desktop" ? 1 : 0,
      );
    });

/** The syntax token kinds of a code panel, each with its own colour rule. */
const TOKEN_KINDS = [
  "keyword",
  "string",
  "type",
  "attr",
  "number",
  "fn",
  "punct",
];

test("a dimmed code line keeps its text, tokens and line number at 4.5:1 in both schemes", () => {
  const rules = siteRules().filter((rule) => rule.at === null);
  /** The last value that a rule with this exact selector declares. */
  const last = (selector: string, property: string) =>
    rules
      .filter((rule) => rule.selectors.includes(selector))
      .map((rule) => declared(rule, property))
      .filter((value) => value !== undefined)
      .at(-1);
  const dimRules = rules.filter((rule) =>
    rule.selectors.some((selector) => selector.includes("site-code-line--dim")),
  );
  const opacity = Number(
    dimRules.map((rule) => declared(rule, "opacity")).findLast(Boolean) ?? 1,
  );
  const problems: string[] = [];
  for (const scheme of ["light", "dark"] as const) {
    const dark = '[data-color-scheme="dark"] ';
    /** The scheme's own value for a selector, or the value for both. */
    const value = (selector: string, property: string) =>
      (scheme === "dark" ? last(dark + selector, property) : undefined) ??
      last(selector, property);
    /** The colour that a dimmed line sets for one of its parts, if any. */
    const dimmed = (part: RegExp) => {
      const colour = (inDark: boolean) =>
        dimRules
          .filter((rule) =>
            rule.selectors.some(
              (selector) =>
                part.test(selector) && selector.startsWith(dark) === inDark,
            ),
          )
          .map((rule) => declared(rule, "color"))
          .findLast(Boolean);
      return (scheme === "dark" ? colour(true) : undefined) ?? colour(false);
    };
    const fill = cssColour(value(".site-code", "background")!, scheme);
    const code = cssColour(value(".site-code", "color")!, scheme);
    const line = dimmed(/site-code-line--dim$/);
    const lineColour =
      line === undefined ? code : cssColour(line, scheme, code);
    const parts: [string, Rgb][] = [["line", lineColour]];
    const tokens = dimmed(/site-code-line--dim\s+[*.[]/);
    for (const kind of TOKEN_KINDS) {
      const own = value(`.site-code-token--${kind}`, "color");
      assert.ok(own, kind);
      parts.push([
        `${kind} token`,
        cssColour(tokens ?? own, scheme, lineColour),
      ]);
    }
    const number =
      dimmed(/site-code-line--dim::before$/) ??
      value(".site-code--numbered .site-code-line::before", "color");
    assert.ok(number, "line number");
    parts.push(["line number", cssColour(number, scheme, lineColour)]);
    for (const [part, colour] of parts) {
      const ratio = contrast(composite(colour, fill, opacity), fill);
      if (ratio < 4.5)
        problems.push(`${scheme} ${part}: ${ratio.toFixed(2)}:1`);
    }
  }
  assert.deepEqual(problems, [], "dimmed text below 4.5:1");
  assert.deepEqual(
    dimRules
      .filter((rule) => declared(rule, "opacity") !== undefined)
      .map((rule) => rule.selectors.join(", ")),
    [],
    "a rule fades the dimmed line",
  );
});
