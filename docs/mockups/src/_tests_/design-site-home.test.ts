import assert from "node:assert/strict";
import { test } from "node:test";

import { openSource } from "../fixtures/site";

import {
  attribute,
  byClass,
  elements,
  label,
  siteDocument,
  siteStyles,
  textContent,
  type Element,
} from "./design-site-test-helpers";

/** Cal's hero heading, with the non-breaking space that keeps "in code." together. */
const HEADING = "Design in\u00a0code.";

/** Cal's hero lead, word for word. */
const LEAD =
  "Generate an interactive mockup of your entire app using your existing React, HTML and CSS components.";

/** Cal's Review body, word for word. */
const REVIEW_BODY =
  "Each comment is tied to the component it is about, so it stays put when the layout changes. Approve when it is right, in step with the pull request review.";

type Parsed = ReturnType<typeof siteDocument>["document"] | Element;

/** The one element of a class inside a node, failing on none or several. */
function only(node: Parsed, name: string): Element {
  const found = byClass(node, name);
  assert.equal(found.length, 1, `one .${name}`);
  return found[0]!;
}

/** The links inside one region, as their labels and destinations. */
function links(region: Element): Array<[string, string | undefined]> {
  return elements(region, (node) => node.tagName === "a").map((link) => [
    label(link),
    attribute(link, "data-mokly-link") ?? attribute(link, "href"),
  ]);
}

/** The first element of one tag inside a node, as text. */
function first(node: Element, tagName: string): string {
  const found = elements(node, (child) => child.tagName === tagName)[0];
  assert.ok(found, `a ${tagName} inside .${attribute(node, "class")}`);
  return label(found);
}

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: the hero draws Cal's heading, lead and actions`, () => {
    const { document } = siteDocument("design/site/home", viewport);
    const hero = only(document, "site-hero");
    const headings = elements(document, (node) => node.tagName === "h1");
    assert.deepEqual(headings.map(textContent), [HEADING]);
    assert.equal(
      elements(hero, (node) => node.tagName === "h1")[0],
      headings[0],
      "the page's only h1 is the hero heading",
    );
    assert.equal(label(only(hero, "site-hero-lead")), LEAD);
    assert.deepEqual(links(only(hero, "site-actions")), [
      ["Get started →", "design/site/docs"],
      ["Download for Mac", openSource.desktopReleases],
    ]);
  });

  test(`${viewport}: the open foundation closes with Get started, View on GitHub and the steps`, () => {
    const { document } = siteDocument("design/site/home", viewport);
    const closing = only(document, "site-closing");
    assert.equal(attribute(closing, "id"), "foundation");
    assert.deepEqual(links(only(closing, "site-actions")), [
      ["Get started →", "design/site/docs"],
      ["View on GitHub", openSource.github],
    ]);
    assert.deepEqual(
      byClass(closing, "site-step").map((step) => [
        first(step, "h3"),
        first(step, "p"),
      ]),
      [
        [
          "Shape the next screen.",
          "Author with React and your shared components.",
        ],
        [
          "Publish the branch.",
          "Open the pull request check to review the screens that changed.",
        ],
        [
          "Build from a shared decision.",
          "Keep comments and approvals with the pull request.",
        ],
      ],
    );
  });

  test(`${viewport}: the feature frames carry their kickers, headings and copy`, () => {
    const { document } = siteDocument("design/site/home", viewport);
    const intro = only(document, "site-section-head");
    const heading = elements(intro, (node) => node.tagName === "h2")[0];
    assert.ok(heading);
    assert.deepEqual(
      [
        ...heading.childNodes.map(textContent).filter(Boolean),
        first(intro, "p"),
      ],
      [
        "Browse, review, edit.",
        "One place for all of it.",
        "Every branch becomes a catalogue your whole team can open.",
      ],
    );
    const modules = byClass(document, "site-module");
    assert.deepEqual(
      modules.map((module) => [
        attribute(module, "id"),
        label(only(module, "site-kicker")),
        first(module, "h3"),
      ]),
      [
        ["browse", "01 Browse", "A visual diff for every branch."],
        ["review", "02 Review", "Sticky comments."],
        ["edit", "03 Edit", "Ask for the change beside the screen."],
      ],
    );
    assert.equal(label(only(modules[1]!, "site-module-body")), REVIEW_BODY);
  });

  test(`${viewport}: the Browse compare lists the five modes with Swipe chosen`, () => {
    const { document } = siteDocument("design/site/home", viewport);
    const viewer = only(only(document, "site-module--browse"), "site-frame");
    assert.deepEqual(byClass(viewer, "site-home-mode").map(label), [
      "Current",
      "Side by side",
      "Overlay",
      "Swipe",
      "Difference",
    ]);
    assert.deepEqual(byClass(viewer, "site-home-mode--chosen").map(label), [
      "Swipe",
    ]);
    assert.equal(byClass(viewer, "site-home-swipe").length, 1);
    assert.deepEqual(byClass(viewer, "site-stage-label").map(label), [
      "main",
      "feat/checkout-v2",
    ]);
  });

  test(`${viewport}: the depictions are hidden from assistive technology and hold nothing to focus`, () => {
    const { document } = siteDocument("design/site/home", viewport);
    const review = only(document, "site-module--review");
    const depictions = [
      only(document, "site-home-spread"),
      only(document, "site-home-check"),
      only(document, "site-frame"),
      only(review, "site-detail"),
      only(document, "site-comment"),
      only(document, "site-home-edit-bar"),
      only(document, "site-home-edit-board"),
      only(document, "site-agent"),
      only(document, "site-home-source-board"),
      only(document, "site-home-connector"),
      ...byClass(document, "site-home-wire"),
    ];
    assert.equal(depictions.length, viewport === "desktop" ? 11 : 10);
    for (const depiction of depictions) {
      const name = attribute(depiction, "class") ?? depiction.tagName;
      assert.equal(attribute(depiction, "aria-hidden"), "true", name);
      assert.deepEqual(
        elements(depiction, (node) =>
          /^(?:a|button|input|select|textarea|h[1-6])$/.test(node.tagName),
        ).map((node) => node.tagName),
        [],
        `${name} holds no control and no heading`,
      );
    }
  });
}

test("the Specs panel lists the page sections on the desktop composition only", () => {
  const desktop = siteDocument("design/site/home", "desktop").document;
  const panel = only(desktop, "site-home-specs");
  assert.equal(panel.tagName, "nav");
  assert.equal(attribute(panel, "aria-label"), "Page sections");
  assert.equal(label(only(panel, "site-panel-title")), "Specs");
  assert.deepEqual(
    byClass(panel, "site-panel-row").map((row) => [
      label(row),
      attribute(row, "href"),
    ]),
    [
      ["Hero", "#hero"],
      ["Browse, review, edit.", "#features"],
      ["01 Browse", "#browse"],
      ["02 Review", "#review"],
      ["03 Edit", "#edit"],
      ["Open foundation", "#foundation"],
      ["Footer", undefined],
    ],
  );
  const mobile = siteDocument("design/site/home", "mobile").document;
  assert.equal(byClass(mobile, "site-home-specs").length, 0);
});

test("split site styles own the home compositions", () => {
  const css = siteStyles();
  for (const selector of [
    ".site-hero",
    ".site-home-spread",
    ".site-frame",
    ".site-module",
    ".site-comment",
    ".site-agent",
    ".site-closing",
    ".site-steps",
  ])
    assert.ok(css.includes(`${selector} {`), selector);
  assert.match(css, /\[data-site-viewport="mobile"\] \.site-home-spread \{/);
});
