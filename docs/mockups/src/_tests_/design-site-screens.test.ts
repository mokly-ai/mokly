import assert from "node:assert/strict";
import { relative, resolve } from "node:path";
import { test } from "node:test";

import { openSource } from "../fixtures/site";

import { catalogueEntries } from "./catalogue-index";
import { screenView } from "./catalogue-paths";
import {
  attribute,
  byClass,
  elements,
  label,
  siteDocument,
  siteEntry,
} from "./design-site-test-helpers";
import { importedStylesheets } from "./imported-stylesheets";
import {
  siteRuleStylesheets,
  siteScreens as screens,
  siteStylesheets,
  type SiteScreenPath,
} from "./site-stylesheets";

test("every site screen owns its folder, viewports and schemes", () => {
  for (const id of screens) {
    const entry = siteEntry(id);
    assert.equal(entry.kind, "screen", id);
    if (entry.kind !== "screen") continue;
    assert.equal(entry.path.split("/").slice(0, 2).join("/"), "design/site");
    assert.equal(entry.variantOf, undefined);
    assert.deepEqual(entry.colorSchemes, ["light", "dark"]);
    for (const viewport of ["mobile", "desktop"] as const)
      for (const scheme of ["light", "dark"] as const)
        assert.equal(
          siteDocument(id, viewport, scheme).route,
          screenView(id, viewport, scheme),
        );
  }
});

test("the Site folder holds the eight canonical screens, the open menu and their tour in order", () => {
  assert.deepEqual(
    catalogueEntries()
      .filter((entry) => entry.path.startsWith("design/site/"))
      .map((entry) => entry.path)
      .sort(),
    [
      ...screens,
      "design/site/docs/first-screen",
      "design/site/docs/first-screen-desktop",
      "design/site/docs/layers",
      "design/site/home/menu",
      "design/site/tour",
    ].sort(),
  );
  const menu = siteEntry("design/site/home/menu");
  assert.equal(menu.kind, "screen");
  if (menu.kind === "screen") assert.equal(menu.variantOf, "design/site/home");

  const tour = siteEntry("design/site/tour");
  assert.equal(tour.kind, "use-case");
  if (tour.kind !== "use-case") return;
  assert.deepEqual(
    tour.steps.map((step) => step.screenPath),
    [...screens],
  );
});

for (const viewport of ["mobile", "desktop"] as const) {
  for (const id of screens) {
    test(`${viewport}: ${id} renders both schemes with the shared landmarks`, () => {
      for (const scheme of ["light", "dark"] as const) {
        const { document } = siteDocument(id, viewport, scheme);
        const headings = elements(document, (node) => node.tagName === "h1");
        assert.equal(headings.length, 1, `${id} ${scheme}: h1`);
        const main = elements(
          document,
          (node) => attribute(node, "id") === "main",
        );
        assert.equal(main.length, 1, `${id} ${scheme}: main`);
        assert.equal(main[0]?.tagName, "main");

        const skip = byClass(document, "site-skip")[0];
        assert.ok(skip);
        assert.equal(attribute(skip, "href"), "#main");
        assert.equal(
          elements(document, (node) => node.tagName === "a").indexOf(skip),
          0,
        );

        const header = byClass(document, "site-header")[0];
        const footer = byClass(document, "site-footer")[0];
        assert.ok(header);
        assert.ok(footer);
        const headerLinks = elements(header, (node) => node.tagName === "a");
        const footerLinks = elements(footer, (node) => node.tagName === "a");
        assert.ok(
          headerLinks.some(
            (node) => attribute(node, "data-mokly-link") === "design/site/docs",
          ),
        );
        assert.ok(
          headerLinks.some(
            (node) => attribute(node, "href") === openSource.github,
          ),
        );
        assert.ok(
          footerLinks.every(
            (node) => attribute(node, "data-mokly-link") !== undefined,
          ),
        );
        assert.deepEqual(
          byClass(document, "site-brand").map((node) =>
            attribute(node, "data-mokly-link"),
          ),
          ["design/site/home", "design/site/home"],
        );
      }
    });
  }

  test(`${viewport}: header and footer retain the documented destinations`, () => {
    const { document } = siteDocument("design/site/home", viewport);
    const headerLinks = elements(
      byClass(document, "site-header")[0]!,
      (node) => node.tagName === "a",
    ).slice(1);
    assert.deepEqual(headerLinks.map(label), [
      "Docs",
      "Changelog",
      "Pricing",
      "GitHub",
      "Get started →",
    ]);
    assert.deepEqual(
      headerLinks.map((node) => attribute(node, "data-mokly-link")),
      [
        "design/site/docs",
        "design/site/changelog",
        "design/site/pricing",
        undefined,
        "product/account/sign-up",
      ],
    );
    const footerLinks = elements(
      byClass(document, "site-footer-nav")[0]!,
      (node) => node.tagName === "a",
    );
    assert.deepEqual(footerLinks.map(label), [
      "Home",
      "Docs",
      "Changelog",
      "Pricing",
      "Terms",
      "Privacy",
      "Complaints",
      "Security",
    ]);
    assert.deepEqual(
      footerLinks.map((node) => attribute(node, "data-mokly-link")),
      [
        "design/site/home",
        "design/site/docs",
        "design/site/changelog",
        "design/site/pricing",
        "design/site/terms",
        "design/site/privacy",
        "design/site/complaints",
        "design/site/security",
      ],
    );
  });
}

/** The style module of each site screen's area. */
const areaModules: Record<SiteScreenPath, string> = {
  "design/site/home": "home",
  "design/site/docs": "docs",
  "design/site/changelog": "changelog",
  "design/site/pricing": "pricing",
  "design/site/terms": "legal",
  "design/site/privacy": "legal",
  "design/site/complaints": "legal",
  "design/site/security": "legal",
};

/** The sheets that one site style module imports, as repository paths. */
function styleModuleSheets(name: string): string[] {
  const root = resolve(import.meta.dirname, "../../../..");
  const module = resolve(
    root,
    `docs/mockups/src/screens/design/site/styles/${name}.ts`,
  );
  return importedStylesheets(module).map((sheet) => relative(root, sheet));
}

// docs/protocol/cloud/mockup-tooling.md: a site page loads the font sheets,
// then the shared sheets, then its own area's sheets, and no other sheet.
test("each site screen loads the shared sheets, then only its own area's sheets", () => {
  const shared = styleModuleSheets("shared");
  for (const id of screens)
    assert.deepEqual(
      siteStylesheets(id),
      [
        ...siteRuleStylesheets(),
        ...shared,
        ...styleModuleSheets(areaModules[id]),
      ],
      id,
    );
});
