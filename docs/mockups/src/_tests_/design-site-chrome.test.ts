import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertHoverChangesMoreThanColor,
  assertStrongBoundaries,
  attribute,
  byClass,
  elements,
  label,
  siteDocument,
  siteScreens,
  siteStyles,
} from "./design-site-test-helpers";

type SiteScreenPath = (typeof siteScreens)[number];

/** The page name that each screen's file title and status bar show. */
const pageNames: Record<SiteScreenPath, string> = {
  "design/site/home": "Home",
  "design/site/docs": "Docs",
  "design/site/changelog": "Changelog",
  "design/site/pricing": "Pricing",
  "design/site/terms": "Terms",
  "design/site/privacy": "Privacy",
  "design/site/complaints": "Complaints",
  "design/site/security": "Security",
};

/** The navigation link that each screen marks as the current page. */
const currentNav: Partial<Record<SiteScreenPath, string>> = {
  "design/site/docs": "Docs",
  "design/site/changelog": "Changelog",
  "design/site/pricing": "Pricing",
};

/** The chrome's controls, each of which promises a hover state. */
const hoverClasses = [
  "site-nav-link",
  "site-menu-button",
  "site-menu-close",
  "site-menu-link",
  "site-brand",
  "site-button--primary",
  "site-button--secondary",
  "site-button--quiet",
  "site-link",
  "site-footer-link",
  "site-scheme-option",
];

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: the tool bar is the one header of every page`, () => {
    for (const id of siteScreens) {
      const { document } = siteDocument(id, viewport);
      const bands = byClass(document, "site-band");
      assert.equal(bands.length, 1, id);
      assert.equal(
        elements(bands[0]!, (node) => node.tagName === "header").length,
        1,
        id,
      );
      assert.equal(
        elements(document, (node) => node.tagName === "header").length,
        1,
        id,
      );
    }
  });

  test(`${viewport}: the tool bar names the page, depicts the file and marks the current page`, () => {
    for (const id of siteScreens) {
      const { document } = siteDocument(id, viewport);
      const header = byClass(document, "site-header")[0]!;
      const title = byClass(header, "site-header-title")[0];
      assert.ok(title, id);
      assert.equal(attribute(title, "aria-hidden"), "true", id);
      assert.equal(
        label(byClass(title, "site-file")[0]!),
        `mokly.ai—${pageNames[id]}`,
      );
      assert.deepEqual(byClass(title, "site-chip").map(label), ["main"], id);
      const presence = byClass(header, "site-presence")[0];
      assert.ok(presence, id);
      assert.equal(attribute(presence, "aria-hidden"), "true", id);
      assert.equal(byClass(presence, "site-avatar").length, 4, id);
      assert.deepEqual(
        elements(
          byClass(header, "site-nav")[0]!,
          (node) => attribute(node, "aria-current") === "page",
        ).map(label),
        currentNav[id] === undefined ? [] : [currentNav[id]],
        id,
      );
      assert.equal(
        elements(header, (node) => attribute(node, "type") === "radio").length,
        0,
        `${id}: no scheme control in the header`,
      );
    }
  });

  test(`${viewport}: the footer frame groups all eight destinations`, () => {
    for (const id of siteScreens) {
      const { document } = siteDocument(id, viewport);
      const footer = byClass(document, "site-footer")[0];
      assert.ok(footer);
      // The home Specs panel's Footer row links this target.
      assert.equal(attribute(footer, "id"), "footer", id);
      const frameName = byClass(footer, "site-frame-name")[0];
      assert.ok(frameName, id);
      assert.equal(label(frameName), "Footer");
      assert.equal(attribute(frameName, "aria-hidden"), "true");
      assert.match(
        label(byClass(footer, "site-footer-brand")[0]!),
        /MIT license/,
      );
      assert.deepEqual(byClass(footer, "site-footer-heading").map(label), [
        "Product",
        "Legal",
      ]);
      const links = byClass(footer, "site-footer-link");
      assert.equal(links.length, 8);
      assert.deepEqual(
        links
          .filter((node) => attribute(node, "aria-current") === "page")
          .map((node) => attribute(node, "data-mokly-link")),
        [id],
      );
    }
  });

  test(`${viewport}: the footer's scheme control checks the document's scheme`, () => {
    for (const id of siteScreens)
      for (const scheme of ["light", "dark"] as const) {
        const { document } = siteDocument(id, viewport, scheme);
        // The scheme control's radios share one name. A page's own control,
        // such as the changelog filter, may hold radios of its own.
        const radios = elements(
          document,
          (node) =>
            node.tagName === "input" &&
            attribute(node, "type") === "radio" &&
            attribute(node, "name") === "site-scheme",
        );
        assert.equal(radios.length, 2, `${id} ${scheme}`);
        assert.equal(
          byClass(document, "site-scheme").length,
          1,
          `${id} ${scheme}: the page holds one scheme control`,
        );
        const brand = byClass(document, "site-footer-brand")[0];
        assert.ok(brand, id);
        const groups = byClass(brand, "site-scheme");
        assert.equal(
          groups.length,
          1,
          `${id} ${scheme}: the scheme control sits in the footer's brand column`,
        );
        const group = groups[0]!;
        assert.equal(group.tagName, "fieldset");
        assert.equal(attribute(group, "aria-label"), "Color scheme");
        const options = byClass(group, "site-scheme-option");
        assert.deepEqual(
          options.map((node) => node.tagName),
          ["label", "label"],
        );
        assert.deepEqual(options.map(label), ["Light", "Dark"]);
        const inputs = options.map(
          (option) => elements(option, (node) => node.tagName === "input")[0]!,
        );
        assert.deepEqual(inputs, radios, `${id} ${scheme}`);
        assert.deepEqual(
          inputs.map((node) => [
            attribute(node, "name"),
            attribute(node, "value"),
          ]),
          [
            ["site-scheme", "light"],
            ["site-scheme", "dark"],
          ],
        );
        assert.deepEqual(
          inputs.map((node) => attribute(node, "checked") !== undefined),
          scheme === "light" ? [true, false] : [false, true],
          `${id} ${scheme}`,
        );
      }
  });

  test(`${viewport}: the status bar depicts the file, the people in it and the zoom`, () => {
    for (const id of siteScreens) {
      const { document } = siteDocument(id, viewport);
      const bar = byClass(document, "site-statusbar")[0];
      assert.ok(bar, id);
      assert.equal(attribute(bar, "aria-hidden"), "true");
      assert.deepEqual(byClass(bar, "site-statusbar-item").map(label), [
        `mokly.ai — ${pageNames[id]}`,
        "MS4 in this file",
      ]);
      assert.equal(byClass(bar, "site-avatar").length, 4);
      assert.equal(label(byClass(bar, "site-statusbar-zoom")[0]!), "−100%+");
      assert.deepEqual(
        elements(bar, (node) =>
          ["a", "button", "input"].includes(node.tagName),
        ),
        [],
      );
    }
  });
}

test("split site styles own the chrome compositions without imports", () => {
  const css = siteStyles();
  assert.doesNotMatch(css, /@import/);
  assert.doesNotMatch(css, /\.pd-/);
  for (const selector of [
    ".site-band",
    ".site-policy",
    ".site-footer-nav",
    ".site-scheme",
    ".site-statusbar",
    ".site-page-frame",
    ".site-frame-name",
    ".site-sel",
    ".site-panel",
    ".site-code",
  ])
    assert.ok(css.includes(`${selector} {`), selector);
});

test("every promised chrome control changes more than color on hover", () => {
  assertHoverChangesMoreThanColor(hoverClasses);
});

// apps/site/tests/styles-focus.test.ts checks the focus glow of every control.
test("meaningful control boundaries use the strong border role", () => {
  // The chosen segment of the footer's scheme control is a control boundary
  // too: it sits raised with a strong ring.
  assertStrongBoundaries([
    ".site-button--quiet",
    ".site-scheme-option:has(.site-scheme-input:checked)",
  ]);
});
