import assert from "node:assert/strict";
import test from "node:test";

import type { ManifestScreen } from "../packages/viewer/dist/registry/types.js";

import {
  named,
  namedRole,
  region,
  twoPreviews,
} from "./helpers/design_assertions.js";
import {
  attribute,
  byClass,
  designEntries,
  designDocument,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";
import {
  comparison,
  hasClass,
  openPanel,
  previews,
  renders,
  type Document,
} from "./helpers/design_stacks.js";

/** The rows an artboard's Comparison details record, by label. */
function evidence(document: Document, where: string): Map<string, string> {
  const [section, ...others] = byClass(document, "ce-comparison-evidence");
  assert.ok(section, where);
  assert.equal(others.length, 0, where);
  return new Map(
    elements(section, (node) => node.tagName === "div").flatMap((row) => {
      const [term] = elements(row, (node) => node.tagName === "dt");
      const [value] = elements(row, (node) => node.tagName === "dd");
      return term && value
        ? [[textContent(term).trim(), textContent(value).trim()] as const]
        : [];
    }),
  );
}

test("component comparison captions follow the recorded change, never the depicted content", async () => {
  const captions = new Map<string, Set<string>>();
  for (const entry of await designEntries(
    (entry): entry is ManifestScreen =>
      entry.kind === "screen" && entry.path.startsWith("design/components/"),
    "component comparison artboards",
  )) {
    for (const { document, route } of await renders(entry.path)) {
      const compared = previews(document).filter(
        ([, preview]) => byClass(preview, "ce-component-comparison").length,
      );
      if (compared.length === 0) continue;
      const rows = evidence(document, route);
      const change = rows.get("Change");
      const variant = rows.get("Saved variant");
      assert.ok(change && variant, `${route} records its change`);
      for (const [viewport, preview] of compared) {
        const { caption } = comparison(preview, `${route} ${viewport}`);
        assert.ok(caption.includes(variant), `${route}: names ${variant}`);
        const forms = captions.get(change) ?? new Set<string>();
        forms.add(caption.replace(variant, "{variant}"));
        captions.set(change, forms);
      }
    }
  }
  assert.ok(captions.size >= 2, "both recorded changes were checked");
  for (const [change, forms] of captions)
    assert.equal(
      forms.size,
      1,
      `${change} is captioned one way: ${[...forms].join(" | ")}`,
    );
});

test("the tall Checklist depicts its parent and selected variant in Changes", async () => {
  const id = "design/components/pages/stacked/overlay-tall";
  for (const viewport of ["desktop", "mobile"] as const) {
    const { document, route } = await designDocument(id, viewport);
    assert.deepEqual(
      byClass(document, "ce-change-status").map((node) => textContent(node)),
      ["Changed"],
      route,
    );
    if (viewport === "desktop") {
      assert.deepEqual(
        elements(
          document,
          (node) => node.tagName === "a" && hasClass(node, "mbk-nav-row"),
        ).map((row) => [
          textContent(row).trim(),
          attribute(row, "data-mokly-link"),
          attribute(row, "aria-current"),
        ]),
        [
          ["ChecklistChanged", id, undefined],
          ["DefaultChanged", id, "page"],
        ],
        `${route}: Changes groups the selected variant under Checklist`,
      );
      assert.deepEqual(
        byClass(document, "mbk-nav-filter-count").map(textContent),
        ["1"],
        route,
      );
    } else {
      const [location] = byClass(document, "ce-mobile-location");
      assert.ok(location, route);
      const changes = elements(
        location,
        (node) => node.tagName === "a" && textContent(node).includes("Changes"),
      );
      assert.deepEqual(
        changes.map((link) => [
          attribute(link, "data-mokly-link"),
          textContent(byClass(link, "ce-change-count")[0]!),
        ]),
        [[id, "1"]],
        `${route}: the Changes shortcut stays on Checklist`,
      );
    }
    assert.equal(openPanel(document), "info", `${route} opens on Details`);
    const [usage] = elements(
      document,
      (node) => attribute(node, "aria-label") === "Used by",
    );
    assert.ok(usage, route);
    assert.equal(
      textContent(byClass(usage, "ce-empty-copy")[0]!).trim(),
      "No screens or components use Checklist yet.",
      route,
    );
    assert.equal(byClass(usage, "ce-usage-list").length, 0, route);
  }
});

for (const viewport of ["desktop", "mobile"] as const) {
  test(`${viewport}: comparison facts appear only in Details when evidence exists`, async () => {
    for (const id of [
      "design/components/pages/comparison",
      "design/components/pages/stacked/overlay",
      "design/components/pages/stacked/difference",
      "design/components/pages/stacked/overlay-tall",
      "design/components/pages/affected",
      "design/components/controls/states/comparison",
      "design/components/states/removed",
      "design/components/states/removed-consumer",
      "design/components/inspection/inspection-direct-change",
    ]) {
      const { document } = await designDocument(id, viewport);
      assert.equal(
        byClass(
          byClass(document, "ce-preview-pane")[0]!,
          "ce-comparison-evidence",
        ).length,
        0,
        id,
      );
      assert.equal(byClass(document, "ce-change-context").length, 0, id);
      const details = region(document, "Details");
      assert.match(textContent(details), /Comparison details/u, id);
      const evidence = byClass(document, "ce-comparison-evidence");
      assert.equal(evidence.length, 1, id);
      assert.ok(
        byClass(details, "ce-comparison-evidence").includes(evidence[0]!),
      );
      assert.doesNotMatch(
        textContent(evidence[0]!),
        /corners and spacing/u,
        id,
      );
      if (id.endsWith("removed-consumer"))
        assert.match(
          textContent(details),
          /A former screen that is no longer in the catalogue\./u,
        );
    }
    for (const id of [
      "design/components/overview",
      "design/components/controls/editing/edited",
      "design/components/states/empty",
    ]) {
      const { document } = await designDocument(id, viewport);
      assert.equal(byClass(document, "ce-comparison-evidence").length, 0, id);
    }
  });

  test(`${viewport}: screen comparison identifies the instance and before/current props`, async () => {
    const { document } = await designDocument(
      "design/components/inspection/inspection-direct-change",
      viewport,
    );
    assert.equal(byClass(document, "ce-change-context").length, 0);
    const evidence = byClass(document, "ce-comparison-evidence")[0]!;
    assert.match(textContent(evidence), /Action · Footer action/u);
    const table = elements(evidence, (node) => node.tagName === "table");
    assert.equal(table.length, 1);
    assert.match(textContent(table[0]!), /Continue/u);
    assert.match(textContent(table[0]!), /Get started/u);
    assert.equal(
      attribute(named(evidence, "Action", "a"), "data-mokly-link"),
      "design/components/pages/affected",
    );
    assert.match(
      textContent(named(document, "Supplied props")),
      /Get started/u,
    );
    assert.equal(byClass(document, "ce-prop-change").length, 0);
  });

  test(`${viewport}: an added Badge has its own preview and Changes rows`, async () => {
    const { document } = await designDocument(
      "design/components/states/additions/added",
      viewport,
    );
    assert.equal(namedRole(document, "group", "Comparison mode").length, 0);
    for (const preview of twoPreviews(document)) {
      assert.equal(byClass(preview, "mbk-pane-missing").length, 0);
      assert.deepEqual(byClass(preview, "ce-badge").map(textContent), ["New"]);
    }
    assert.deepEqual(
      byClass(
        document,
        viewport === "desktop" ? "mbk-nav-filter-count" : "ce-change-count",
      ).map(textContent),
      ["1"],
    );
    if (viewport === "desktop") {
      const nav = byClass(document, "mbk-nav-scroll")[0]!;
      assert.deepEqual(
        elements(nav, (node) => node.tagName === "a").map((node) =>
          textContent(node)
            .replace(/Changed$/u, "")
            .trim(),
        ),
        ["Badge", "Default"],
      );
      assert.equal(byClass(nav, "mbk-nav-changed").length, 2);
    }
  });
}
