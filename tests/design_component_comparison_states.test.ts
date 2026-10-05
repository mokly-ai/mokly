import assert from "node:assert/strict";
import test from "node:test";

import {
  attribute,
  byClass,
  designCatalogue,
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
  const { manifest } = await designCatalogue;
  const captions = new Map<string, Set<string>>();
  for (const entry of manifest.entries) {
    if (entry.kind !== "screen" || !entry.path.startsWith("design/components/"))
      continue;
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
