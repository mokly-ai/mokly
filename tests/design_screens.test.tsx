import assert from "node:assert/strict";
import { test } from "node:test";

import { entryRoute } from "../packages/viewer/dist/data.js";

import { assertAbsent } from "./helpers/catalogue_selection.js";
import {
  attribute,
  byClass,
  designCatalogue,
  designDocument,
  textContent,
} from "./helpers/design_catalogue.js";

const additions = [
  [
    "design/browse/views/details-screen",
    "design/browse/views/details-screen/index.html",
  ],
  [
    "design/browse/views/screen/tag-picker",
    "design/browse/views/screen/tag-picker/index.html",
  ],
  [
    "design/browse/views/screen/tag-forms",
    "design/browse/views/screen/tag-forms/index.html",
  ],
  [
    "design/browse/views/screen/tag-onboarding",
    "design/browse/views/screen/tag-onboarding/index.html",
  ],
  [
    "design/browse/views/screen/tag-onboarding-picker",
    "design/browse/views/screen/tag-onboarding-picker/index.html",
  ],
] as const;

const convertedVariants = [
  ["design/browse/views/screen/dark-scheme", "dark-scheme"],
  ["design/browse/views/screen/light-only", "light-only"],
  ["design/browse/views/screen/tag-picker", "picker"],
  ["design/browse/views/screen/tag-forms", "forms"],
  ["design/browse/views/screen/tag-onboarding", "onboarding"],
  ["design/browse/views/screen/tag-onboarding-picker", "onboarding-picker"],
] as const;

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
  assertAbsent(manifest, "design/browse/tags");
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
