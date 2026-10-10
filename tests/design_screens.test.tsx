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
    (entry) => entry.path === "design/browse/views/screen",
  );
  assert.ok(parent?.kind === "screen");
  for (const [id] of convertedVariants) {
    const entry = manifest.entries.find((candidate) => candidate.path === id);
    assert.equal(entry?.kind, "screen", id);
    if (entry?.kind !== "screen") continue;
    assert.equal(entryRoute(entry.path), `${id}/index.html`, id);
    assert.equal(entry.variantOf, "design/browse/views/screen", id);
    assert.ok(entry.path.startsWith(`${parent.path}/`), id);
  }
  assert.equal(
    manifest.entries.some((entry) => entry.path === "design-browse-tags"),
    false,
  );
  const filter = manifest.entries.find(
    (entry) => entry.path === "design/browse/states/tag-filter",
  );
  assert.equal(filter?.path, "design/browse/states/tag-filter");
});

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: catalogue navigation separates specs and components`, async () => {
    const { document } = await designDocument(
      viewport === "mobile"
        ? "design/browse/states/navigation"
        : "design/browse/views/home",
      viewport,
    );
    const sections = byClass(document, "mbk-nav-section");
    assert.deepEqual(
      sections.map((section) => attribute(section, "data-nav-section")),
      ["specs", "components"],
    );
    assert.ok(sections.every((section) => attribute(section, "open") === ""));
    assert.deepEqual(
      sections.map((section) =>
        textContent(byClass(section, "mbk-nav-section-head")[0]!).trim(),
      ),
      ["Specs", "Components"],
    );
    const specs = textContent(sections[0] ?? document);
    const components = textContent(sections[1] ?? document);
    assert.match(specs, /Welcome/);
    assert.match(specs, /Example tour/);
    assert.match(specs, /Overview/);
    assert.doesNotMatch(specs, /Action|Toolbar/);
    assert.match(components, /Action/);
    assert.match(components, /Toolbar/);
    assert.doesNotMatch(components, /Welcome|Example tour/);
  });

  test(`${viewport}: all five owning destinations keep their route and frame`, async () => {
    for (const [id, route] of additions) {
      const { entry, document } = await designDocument(id, viewport);
      assert.equal(entryRoute(entry.path), route);
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
      ["design/browse/views/screen/tag-picker", undefined, true],
      ["design/browse/states/tag-filter", "forms", true],
      ["design/browse/views/screen/tag-forms", "forms", false],
      ["design/browse/views/screen/tag-onboarding", "onboarding", false],
      ["design/browse/views/screen/tag-onboarding-picker", "onboarding", true],
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
  const detailPage = await designDocument(
    "design/changes/outcomes/added",
    "desktop",
  );
  const detailBody = byClass(detailPage.document, "mbk-details-body")[0];
  assert.ok(detailBody);
  const details = textContent(detailBody);
  assert.match(details, /Additional context for the example catalogue/);
  assert.doesNotMatch(details, /Generated|details\/index\.html/);
  assert.doesNotMatch(
    details,
    /welcome\/index\.html|landing screen|onboarding/,
  );
  assert.match(details, /Example tour/);
  const removedPage = await designDocument(
    "design/changes/outcomes/removed",
    "desktop",
  );
  const removedBody = byClass(removedPage.document, "mbk-details-body")[0];
  assert.ok(removedBody);
  const removed = textContent(removedBody);
  assert.doesNotMatch(removed, /welcome\/index\.html|Example tour|onboarding/);
  assert.match(removed, /Farewell/);
});

test("review impact omits the path-only state and retains the rendered evidence states", async () => {
  const { manifest, outputs } = await designCatalogue;
  const impact = manifest.entries.filter((entry) =>
    entry.path.startsWith("design/changes/impact/"),
  );
  assert.deepEqual(impact.map((entry) => entry.path).sort(), [
    "design/changes/impact/empty",
    "design/changes/impact/ignored-only",
    "design/changes/impact/styles/matched-excluded/excluded",
    "design/changes/impact/styles/matched-excluded/excluded-only",
    "design/changes/impact/styles/matched-excluded/matched",
    "design/changes/impact/styles/page",
    "design/changes/impact/styles/unresolved-unnamed/unnamed",
    "design/changes/impact/styles/unresolved-unnamed/unresolved",
  ]);
  assert.equal(
    manifest.entries.some(
      (entry) => entry.path === "design/changes/impact/shared-impact",
    ),
    false,
  );
  for (const [route, html] of outputs) {
    if (!route.startsWith("design/changes/")) continue;
    assert.ok(typeof html === "string");
    assert.doesNotMatch(
      html,
      /design-review-shared-impact|shared impact/i,
      route,
    );
  }
});
