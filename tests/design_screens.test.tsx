import assert from "node:assert/strict";
import { test } from "node:test";

import {
  attribute,
  byClass,
  designCatalogue,
  designDocument,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";

const additions = [
  ["design-browse-details-screen", "design/browse/views/details-screen.html"],
  [
    "design-browse-tag-picker",
    "design/browse/views/screen.variants/picker.html",
  ],
  ["design-browse-tag-forms", "design/browse/views/screen.variants/forms.html"],
  [
    "design-browse-tag-onboarding",
    "design/browse/views/screen.variants/onboarding.html",
  ],
  [
    "design-browse-tag-onboarding-picker",
    "design/browse/views/screen.variants/onboarding-picker.html",
  ],
] as const;

const convertedVariants = [
  ["design-browse-dark-scheme", "dark-scheme"],
  ["design-browse-light-only", "light-only"],
  ["design-browse-tag-picker", "picker"],
  ["design-browse-tag-forms", "forms"],
  ["design-browse-tag-onboarding", "onboarding"],
  ["design-browse-tag-onboarding-picker", "onboarding-picker"],
] as const;

test("the Welcome conversion moves exactly the approved screens out of collections", async () => {
  const { manifest } = await designCatalogue;
  const collections = manifest.entries.filter(
    (entry) => entry.kind === "collection",
  );
  for (const [id, slug] of convertedVariants) {
    const entry = manifest.entries.find((candidate) => candidate.id === id);
    assert.equal(entry?.kind, "screen", id);
    if (entry?.kind !== "screen") continue;
    assert.equal(
      entry.route,
      `design/browse/views/screen.variants/${slug}.html`,
      id,
    );
    assert.equal(entry.variantOf, "design-browse-screen", id);
    assert.deepEqual(
      collections.filter((collection) => collection.childIds.includes(id)),
      [],
      id,
    );
  }
  const tagStates = collections.find(
    (entry) => entry.id === "design-browse-tags",
  );
  assert.deepEqual(tagStates?.childIds, []);
  const shellStates = collections.find(
    (entry) => entry.id === "design-browse-states",
  );
  assert.ok(shellStates?.childIds.includes("design-browse-tag-filter"));
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

  test(`${viewport}: all five owning destinations render as light-only designs`, async () => {
    for (const [id, route] of additions) {
      const { entry, document } = await designDocument(id, viewport);
      assert.equal(entry.route, route);
      assert.equal(entry.darkFragments, undefined);
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

  test(`${viewport}: light endpoints expose the paired scheme control`, async () => {
    for (const id of [
      "design-browse-screen",
      "design-browse-details-screen",
      "design-review-changed",
    ]) {
      const { document } = await designDocument(id, viewport);
      assert.equal(
        elements(
          document,
          (node) => attribute(node, "aria-label") === "Switch to dark mode",
        ).length,
        1,
        id,
      );
    }
  });

  test(`${viewport}: a light-only fallback presents its effective Light status`, async () => {
    const { document } = await designDocument(
      "design-browse-light-only",
      viewport,
    );
    assert.deepEqual(
      byClass(document, "ce-change-status").map((node) =>
        textContent(node).trim(),
      ),
      ["Unmodified"],
    );
    assert.equal(byClass(document, "ce-view-changed").length, 0);
    assert.equal(byClass(document, "mbk-cmp-toolbar").length, 0);
  });
}

test("inspector metadata belongs to its depicted subject", async () => {
  const detailPage = await designDocument("design-review-added", "desktop");
  const detailBody = byClass(detailPage.document, "mbk-details-body")[0];
  assert.ok(detailBody);
  const details = textContent(detailBody);
  assert.match(details, /screens\/details\.html/);
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

const stylesheetEvidence = [
  [
    "design-review-style-matched",
    "design/review/impact/stylesheets/matched.html",
    "Changed styles that apply to this screen",
  ],
  [
    "design-review-style-unresolved",
    "design/review/impact/stylesheets/unresolved.html",
    "This change can apply anywhere on the screen, so the screen stays in Changes:",
  ],
  [
    "design-review-style-unnamed",
    "design/review/impact/stylesheets/unnamed.html",
    "This change can apply anywhere on the screen, so the screen stays in Changes.",
  ],
  [
    "design-review-style-excluded",
    "design/review/impact/stylesheets/excluded.html",
    "This stylesheet changed, but none of the changed styles apply to this screen",
  ],
] as const;

const comparedStyleScreens = [
  "design-review-style-matched",
  "design-review-style-unresolved",
  "design-review-style-unnamed",
] as const;

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: stylesheet evidence states keep selectors out of headings`, async () => {
    for (const [id, route, copy] of stylesheetEvidence) {
      const { entry, document } = await designDocument(id, viewport);
      assert.equal(entry.route, route);
      assert.equal(entry.darkFragments, undefined);
      const evidence = byClass(document, "mbk-comparison-details")[0];
      assert.ok(evidence, id);
      const text = textContent(evidence);
      assert.ok(text.includes(copy), `${id}: ${text}`);
      assert.match(text, /generated\/styles\.css/, id);
      const compared = comparedStyleScreens.includes(
        id as (typeof comparedStyleScreens)[number],
      );
      const outcome = byClass(document, "mbk-comparison-stage").map((stage) =>
        textContent(elements(stage, (node) => node.tagName === "h3")[0]!),
      );
      assert.deepEqual(
        outcome,
        compared
          ? ["Mobile", "Desktop"].map(
              (name) => `${name} · Styles this screen uses changed`,
            )
          : [],
        id,
      );
      assert.equal(
        byClass(document, "mbk-compare").length,
        compared ? 2 : 0,
        id,
      );
      assert.deepEqual(
        byClass(document, "mbk-compare-label").map((node) =>
          textContent(node).trim(),
        ),
        compared ? ["Before", "Current", "Before", "Current"] : [],
        id,
      );
      assert.equal(
        byClass(document, "mbk-cmp-toolbar").length,
        compared ? 1 : 0,
        id,
      );
      if (!compared)
        assert.ok(text.trimEnd().endsWith("No changes to this screen."), id);
      for (const heading of elements(document, (node) =>
        ["h1", "h2", "h3"].includes(node.tagName),
      ))
        assert.doesNotMatch(
          textContent(heading),
          /\.example-head|main a|:root/,
          id,
        );
    }
  });
}

test("stylesheet evidence states are entered and left through the filter", async () => {
  for (const [source, filter, target] of [
    ["design-review-shared-impact", "Changes0", "design-review-style-matched"],
    [
      "design-review-ignored-only",
      "Changes0",
      "design-review-style-unresolved",
    ],
    ["design-review-style-matched", "All", "design-review-style-excluded"],
    ["design-review-style-unresolved", "All", "design-browse-screen"],
    ["design-review-style-unnamed", "All", "design-browse-screen"],
    ["design-review-style-excluded", "Changes0", "design-review-empty"],
  ] as const) {
    const { document } = await designDocument(source, "desktop");
    assert.deepEqual(
      byClass(document, "mbk-nav-filter-opt")
        .filter((node) => node.tagName === "a")
        .map((node) => [
          textContent(node).trim(),
          attribute(node, "data-mokly-link"),
        ]),
      [[filter, target]],
      source,
    );
  }
});
