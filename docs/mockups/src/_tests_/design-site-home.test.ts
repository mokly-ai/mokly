import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";

import { openSource } from "../fixtures/site";

import { first, only } from "./design-site-home-helpers";
import {
  attribute,
  byClass,
  cssRules,
  elements,
  label,
  repositoryRoot,
  siteDocument,
  siteStyles,
  siteStylesheets,
  textContent,
  type Element,
} from "./design-site-test-helpers";

/** Cal's hero heading, with the non-breaking space that keeps "in code." together. */
const HEADING = "Design in\u00a0code.";

/** Cal's hero lead, word for word. */
const LEAD =
  "Generate an interactive mockup of your entire app using your existing React, HTML and CSS components.";

/** The links inside one region, as their labels and destinations. */
function links(region: Element): Array<[string, string | undefined]> {
  return elements(region, (node) => node.tagName === "a").map((link) => [
    label(link),
    attribute(link, "data-mokly-link") ?? attribute(link, "href"),
  ]);
}

/** The serif that the depicted acme/storefront app names. */
const DEMO_SERIF = "Instrument Serif";

/** The first family that one rule's declarations name, without quotes. */
function firstFamily(declarations: string): string | undefined {
  const families = /(?:^|;)\s*font-family\s*:([^;]*)/.exec(declarations)?.[1];
  return families
    ?.split(",")[0]
    ?.trim()
    .replace(/^["']|["']$/g, "");
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
      ["02 Changes", "#changes"],
      ["03 Review", "#review"],
      ["04 Edit", "#edit"],
      ["Open foundation", "#foundation"],
      ["Footer", "#footer"],
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

test("the site styles host the Instrument Serif face that the demo app names", () => {
  const serif = siteStylesheets()
    .flatMap((path) =>
      cssRules(readFileSync(resolve(repositoryRoot, path), "utf8")).map(
        (rule) => ({ ...rule, path, selector: rule.selector.trim() }),
      ),
    )
    .filter((rule) => firstFamily(rule.declarations) === DEMO_SERIF);
  const users = serif.filter((rule) => rule.selector !== "@font-face");
  const faces = serif.filter((rule) => rule.selector === "@font-face");
  assert.ok(users.length > 0, `a demo app rule draws in ${DEMO_SERIF}`);
  assert.ok(
    faces.length > 0,
    `no @font-face hosts ${DEMO_SERIF} for ${users.map((rule) => rule.selector).join(", ")}`,
  );
  for (const face of faces) {
    const files = [
      ...face.declarations.matchAll(/url\(\s*["']?([^"')]+)/g),
    ].map((match) => match[1]!);
    assert.ok(files.length > 0, `the face in ${face.path} names its file`);
    for (const file of files)
      assert.ok(
        existsSync(resolve(repositoryRoot, dirname(face.path), file)),
        `${face.path} names ${file}, which does not exist`,
      );
  }
});
