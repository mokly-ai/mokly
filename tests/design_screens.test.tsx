import assert from "node:assert/strict";
import { test } from "node:test";

import { entryRoute } from "../packages/viewer/dist/data.js";

import { additions, convertedVariants } from "./design_screens_fixture.js";
import {
  attribute,
  byClass,
  designCatalogue,
  designDocument,
  textContent,
} from "./helpers/design_catalogue.js";

test("the Welcome conversion keeps the approved screens as variants, not folder members", async () => {
  const { manifest } = await designCatalogue;
  const parent = manifest.entries.find(
    (entry) => entry.id === "design-browse-screen",
  );
  assert.ok(parent?.kind === "screen");
  for (const [id] of convertedVariants) {
    const entry = manifest.entries.find((candidate) => candidate.id === id);
    assert.equal(entry?.kind, "screen", id);
    if (entry?.kind !== "screen") continue;
    assert.equal(entryRoute("screen", entry.id), `screens/${id}.html`, id);
    assert.equal(entry.variantOf, "design-browse-screen", id);
    assert.deepEqual(entry.navPath, parent.navPath, id);
  }
  assert.equal(
    manifest.entries.some((entry) => entry.id === "design-browse-tags"),
    false,
  );
  const filter = manifest.entries.find(
    (entry) => entry.id === "design-browse-tag-filter",
  );
  assert.deepEqual(filter?.navPath, [
    "Design",
    "Mokly design",
    "Browse shell",
    "Shell states",
  ]);
});

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: catalogue navigation separates pages and components`, async () => {
    const { document } = await designDocument(
      viewport === "mobile" ? "design-browse-navigation" : "design-browse-home",
      viewport,
    );
    const sections = byClass(document, "mbk-nav-section");
    assert.deepEqual(
      sections.map((section) => attribute(section, "data-nav-section")),
      ["pages", "components"],
    );
    assert.ok(sections.every((section) => attribute(section, "open") === ""));
    const pages = textContent(sections[0] ?? document);
    const components = textContent(sections[1] ?? document);
    assert.match(pages, /Welcome/);
    assert.match(pages, /Example tour/);
    assert.doesNotMatch(pages, /Action|Toolbar/);
    assert.match(components, /Action/);
    assert.match(components, /Toolbar/);
    assert.doesNotMatch(components, /Welcome|Example tour/);
  });

  test(`${viewport}: all five owning destinations keep their route and frame`, async () => {
    for (const [id, route] of additions) {
      const { entry, document } = await designDocument(id, viewport);
      assert.equal(entryRoute("screen", entry.id), route);
      assert.equal(byClass(document, "mbk-shell").length, 1);
      assert.equal(
        byClass(
          document,
          viewport === "mobile" ? "phone-frame" : "browser-frame",
        ).length,
        1,
      );
    }
  });

  test(`${viewport}: tag states agree on query, picker, selection, and visible rows`, async () => {
    for (const [id, tag, picker] of [
      ["design-browse-tag-picker", undefined, true],
      ["design-browse-tag-filter", "forms", true],
      ["design-browse-tag-forms", "forms", false],
      ["design-browse-tag-onboarding", "onboarding", false],
      ["design-browse-tag-onboarding-picker", "onboarding", true],
    ] as const) {
      const { document } = await designDocument(id, viewport);
      const query = byClass(document, "mbk-search-value").map(textContent);
      assert.deepEqual(query, tag ? [`tag:${tag}`] : [], id);
      assert.equal(
        byClass(document, "mbk-tag-picker").length,
        Number(picker),
        id,
      );
      for (const chip of byClass(document, "mbk-chip").filter(
        (node) => byClass(node, "active").length,
      )) {
        assert.equal(textContent(chip).trim(), tag, id);
      }
      if (viewport === "desktop" && tag) {
        const rows = byClass(document, "mbk-nav-row").map((row) =>
          textContent(row).trim(),
        );
        assert.ok(rows.includes("Welcome"), id);
        assert.equal(rows.includes("Details"), tag === "forms", id);
        assert.ok(!rows.includes("Example tour"), id);
      }
    }
  });
}

test("inspector metadata belongs to its depicted subject", async () => {
  const detailPage = await designDocument("design-review-added", "desktop");
  const detailBody = byClass(detailPage.document, "mbk-details-body")[0];
  assert.ok(detailBody);
  const details = textContent(detailBody);
  assert.match(details, /Additional context for the example catalogue/);
  assert.doesNotMatch(details, /Generated|screens\/details\.html/);
  assert.doesNotMatch(
    details,
    /screens\/welcome\.html|landing screen|onboarding/,
  );
  assert.match(details, /Example tour/);
  const removedPage = await designDocument("design-review-removed", "desktop");
  const removedBody = byClass(removedPage.document, "mbk-details-body")[0];
  assert.ok(removedBody);
  const removed = textContent(removedBody);
  assert.doesNotMatch(
    removed,
    /screens\/welcome\.html|Example tour|onboarding/,
  );
  assert.match(removed, /Farewell/);
});

test("review impact omits the path-only state and retains the rendered evidence states", async () => {
  const { manifest, outputs } = await designCatalogue;
  const impact = manifest.entries.filter((entry) =>
    entry.navPath.includes("Impact states"),
  );
  assert.deepEqual(impact.map((entry) => entry.id).sort(), [
    "design-review-empty",
    "design-review-ignored-only",
    "design-review-style-excluded",
    "design-review-style-matched",
    "design-review-style-page",
    "design-review-style-unnamed",
    "design-review-style-unresolved",
  ]);
  assert.equal(
    manifest.entries.some(
      (entry) => entry.id === "design-review-shared-impact",
    ),
    false,
  );
  for (const [route, html] of outputs) {
    if (!route.startsWith("screens/design-review-")) continue;
    assert.ok(typeof html === "string");
    assert.doesNotMatch(
      html,
      /design-review-shared-impact|shared impact/i,
      route,
    );
  }
});
