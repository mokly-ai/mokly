import assert from "node:assert/strict";
import { test } from "node:test";

import { parse } from "parse5";

import {
  attribute,
  byClass,
  designCatalogue,
  designDocument,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";

const SITE_SCREENS = [
  ["design-site-home", "design/site/home.html"],
  ["design-site-docs", "design/site/docs.html"],
  ["design-site-changelog", "design/site/changelog.html"],
  ["design-site-terms", "design/site/terms.html"],
  ["design-site-privacy", "design/site/privacy.html"],
] as const;

const HEADER_LINKS = ["Docs", "Changelog", "Sign in", "Get started →"];

const FOOTER_LINKS = [
  "Home",
  "Docs",
  "Changelog",
  "Sign in",
  "Get started",
  "Terms",
  "Privacy",
];

const CURRENT_MARKS = new Map([
  // The brand links home from the header and the footer, so the home marks it
  // twice before the footer's own Home link.
  ["design-site-home", ["mokly.", "mokly.", "Home"]],
  ["design-site-docs", ["Docs", "Install", "Docs"]],
  ["design-site-changelog", ["Changelog", "Changelog"]],
  ["design-site-terms", ["Terms"]],
  ["design-site-privacy", ["Privacy"]],
]);

const SIGN_IN = "https://app.mokly.ai/sign-in";
const SIGN_UP = "https://app.mokly.ai/sign-up";

function label(node: Parameters<typeof textContent>[0]): string {
  return textContent(node).replace(/\s+/g, " ").trim();
}

test("every site screen owns its route, both viewports and both schemes", async () => {
  const { manifest } = await designCatalogue;
  for (const [id, route] of SITE_SCREENS) {
    const entry = manifest.entries.find((entry) => entry.id === id);
    assert.ok(entry?.kind === "screen", id);
    assert.equal(entry.route, route);
    assert.deepEqual(entry.fragments, {
      desktop: route.replace(".html", ".desktop.html"),
      mobile: route.replace(".html", ".mobile.html"),
    });
    assert.deepEqual(entry.darkFragments, {
      desktop: route.replace(".html", ".desktop.dark.html"),
      mobile: route.replace(".html", ".mobile.dark.html"),
    });
    assert.deepEqual(entry.declaredDependencies, [
      "examples/basic/generated/site-tokens.css",
      "examples/basic/generated/site.css",
    ]);
  }
});

test("the site collection and its tour reuse the five screens in order", async () => {
  const { manifest } = await designCatalogue;
  const collection = manifest.entries.find(
    (entry) => entry.id === "design-site",
  );
  assert.ok(collection?.kind === "collection");
  assert.deepEqual(collection.childIds, [
    ...SITE_SCREENS.map(([id]) => id),
    "design-site-tour",
  ]);
  const root = manifest.entries.find((entry) => entry.id === "design-root");
  assert.ok(root?.kind === "collection");
  assert.ok(root.childIds.includes("design-site"));
  const tour = manifest.entries.find(
    (entry) => entry.id === "design-site-tour",
  );
  assert.ok(tour?.kind === "use-case");
  assert.equal(tour.route, "user-flows/design/site-tour.html");
  assert.deepEqual(
    tour.steps.map((step) => step.screenId),
    SITE_SCREENS.map(([id]) => id),
  );
});

for (const viewport of ["mobile", "desktop"] as const) {
  for (const [id] of SITE_SCREENS) {
    test(`${viewport}: ${id} renders one document landmark and the shared chrome`, async () => {
      const compilation = await designCatalogue;
      const light = await designDocument(id, viewport);
      const darkRoute = light.entry.darkFragments?.[viewport];
      assert.ok(darkRoute);
      const darkHtml = compilation.outputs.get(darkRoute);
      assert.ok(darkHtml, darkRoute);
      for (const document of [light.document, parse(darkHtml)]) {
        const headings = elements(document, (node) => node.tagName === "h1");
        assert.equal(headings.length, 1, id);
        const main = elements(
          document,
          (node) => attribute(node, "id") === "main",
        );
        assert.equal(main.length, 1, id);
        assert.equal(main[0]?.tagName, "main", id);
        const skip = byClass(document, "site-skip")[0];
        assert.ok(skip, id);
        assert.equal(skip.tagName, "a");
        assert.equal(attribute(skip, "href"), "#main");
        assert.equal(
          elements(document, (node) => node.tagName === "a").indexOf(skip),
          0,
          `${id}: skip link is not first`,
        );

        const header = byClass(document, "site-header")[0];
        assert.ok(header, id);
        const headerLinks = elements(
          header,
          (node) => node.tagName === "a",
        ).slice(1);
        assert.deepEqual(headerLinks.map(label), HEADER_LINKS, id);
        assert.equal(attribute(headerLinks[2]!, "href"), SIGN_IN, id);
        assert.equal(attribute(headerLinks[3]!, "href"), SIGN_UP, id);
        for (const index of [1, 3]) {
          assert.match(
            attribute(headerLinks[index]!, "class") ?? "",
            /site-desktop-only/,
            `${id}: header link ${index} stays desktop only`,
          );
        }

        const footer = byClass(document, "site-footer")[0];
        assert.ok(footer, id);
        const footerLinks = elements(
          footer,
          (node) => node.tagName === "a",
        ).slice(1);
        assert.deepEqual(footerLinks.map(label), FOOTER_LINKS, id);
        assert.equal(attribute(footerLinks[3]!, "href"), SIGN_IN, id);
        assert.equal(attribute(footerLinks[4]!, "href"), SIGN_UP, id);

        assert.deepEqual(
          elements(
            document,
            (node) => attribute(node, "aria-current") === "page",
          ).map(label),
          CURRENT_MARKS.get(id),
          `${id}: current route marking`,
        );
      }
    });
  }

  test(`${viewport}: the brand links home from the header and the footer`, async () => {
    for (const [id] of SITE_SCREENS) {
      const { document } = await designDocument(id, viewport);
      const brands = byClass(document, "site-brand");
      assert.equal(brands.length, 2, id);
      for (const brand of brands) {
        assert.equal(brand.tagName, "a", id);
        assert.equal(attribute(brand, "aria-label"), "Mokly home", id);
        assert.equal(
          attribute(brand, "data-mokly-link"),
          "design-site-home",
          id,
        );
      }
    }
  });
}
