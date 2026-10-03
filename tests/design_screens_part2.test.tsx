import assert from "node:assert/strict";
import { test } from "node:test";

import { entryRoute } from "../packages/viewer/dist/data.js";

import {
  comparedStyleScreens,
  stylesheetCardGroups,
  stylesheetEvidence,
} from "./design_screens_fixture.js";
import {
  attribute,
  byClass,
  designDocument,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";
import { stylesheetGroups } from "./helpers/design_evidence.js";

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: component inspector has no declared dependency row`, async () => {
    for (const id of [
      "design-component-overview",
      "design-component-toolbar",
      "design-component-unused",
    ]) {
      const { document } = await designDocument(id, viewport);
      const details = byClass(document, "ce-slot-details")[0];
      assert.ok(details, id);
      const content = textContent(details);
      assert.match(content, /Schemes|Related docs/, id);
      assert.doesNotMatch(content, /Dependencies/, id);
    }
  });

  test(`${viewport}: stylesheet evidence states keep selectors out of headings`, async () => {
    for (const [id, route, copy] of stylesheetEvidence) {
      const { entry, document } = await designDocument(id, viewport);
      assert.equal(entryRoute("screen", entry.id), route);
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
        compared || id === "design-review-style-excluded" ? 1 : 0,
        id,
      );
      if (!compared)
        assert.ok(
          text
            .trimEnd()
            .endsWith("Other changed styles keep Welcome in Changes."),
          id,
        );
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

for (const viewport of ["mobile", "desktop"] as const)
  test(`${viewport}: stylesheet evidence nests each outcome under its stylesheet`, async () => {
    for (const [id, outcomes] of stylesheetCardGroups) {
      const { document } = await designDocument(id, viewport);
      const card = byClass(document, "mbk-comparison-details")[0];
      assert.ok(card, id);
      assert.deepEqual(stylesheetGroups(card, id), {
        lead: "Changes to these files may affect this screen:",
        files: [
          [
            "generated/styles.css",
            outcomes.map(([lead, selectors]) => [lead, [...selectors]]),
          ],
        ],
      });
    }
  });

test("stylesheet evidence states are entered and left through the filter", async () => {
  for (const [source, filter, target] of [
    ["design-review-ignored-only", "Changes0", "design-review-empty"],
    ["design-review-style-excluded", "Changes1", "design-review-style-matched"],
    ["design-review-style-matched", "All", "design-review-style-excluded"],
    ["design-review-style-unresolved", "All", "design-browse-screen"],
    ["design-review-style-unnamed", "All", "design-browse-screen"],
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
