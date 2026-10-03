import assert from "node:assert/strict";
import { test } from "node:test";

import { entryRoute } from "../packages/viewer/dist/data.js";

import {
  attribute,
  byClass,
  designCatalogue,
  designDocument,
  elements,
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

const stylesheetEvidence = [
  [
    "design/changes/impact/styles/matched",
    "design/changes/impact/styles/matched/index.html",
    "Changed styles that apply to this screen",
  ],
  [
    "design/changes/impact/styles/unresolved",
    "design/changes/impact/styles/unresolved/index.html",
    "This change can apply anywhere on the screen, so the screen stays in Changes:",
  ],
  [
    "design/changes/impact/styles/unnamed",
    "design/changes/impact/styles/unnamed/index.html",
    "This change can apply anywhere on the screen, so the screen stays in Changes.",
  ],
  [
    "design/changes/impact/styles/excluded",
    "design/changes/impact/styles/excluded/index.html",
    "This stylesheet changed, but none of the changed styles apply to this screen",
  ],
] as const;

const comparedStyleScreens = [
  "design/changes/impact/styles/matched",
  "design/changes/impact/styles/unresolved",
  "design/changes/impact/styles/unnamed",
] as const;

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: stylesheet evidence states keep selectors out of headings`, async () => {
    for (const [id, route, copy] of stylesheetEvidence) {
      const { entry, document } = await designDocument(id, viewport);
      assert.equal(entryRoute(entry.path), route);
      assert.deepEqual(entry.colorSchemes, ["light"]);
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
    [
      "design/changes/impact/shared-impact",
      "Changes0",
      "design/changes/impact/styles/matched",
    ],
    [
      "design/changes/impact/ignored-only",
      "Changes0",
      "design/changes/impact/styles/unresolved",
    ],
    [
      "design/changes/impact/styles/matched",
      "All",
      "design/changes/impact/styles/excluded",
    ],
    [
      "design/changes/impact/styles/unresolved",
      "All",
      "design/browse/views/screen",
    ],
    [
      "design/changes/impact/styles/unnamed",
      "All",
      "design/browse/views/screen",
    ],
    [
      "design/changes/impact/styles/excluded",
      "Changes0",
      "design/changes/impact/empty",
    ],
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
