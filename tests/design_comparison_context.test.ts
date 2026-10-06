import assert from "node:assert/strict";
import test from "node:test";

import {
  attribute,
  byClass,
  designDocument,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";
import { headTitle } from "./helpers/design_rows.js";
import { openPanel } from "./helpers/design_stacks.js";

for (const viewport of ["desktop", "mobile"] as const) {
  test(`${viewport}: flows keep comparisons on their owning screens`, async () => {
    const { document } = await designDocument(
      "design/browse/views/use-case",
      viewport,
    );
    assert.equal(
      elements(
        document,
        (node) => attribute(node, "aria-label") === "Comparison mode",
      ).length,
      0,
    );
    assert.equal(byClass(document, "flow-step-link").length, 2);
  });

  test(`${viewport}: comparisons show screen context without report chrome`, async () => {
    for (const route of [
      "outcomes/changed",
      "outcomes/added",
      "outcomes/removed",
      "outcomes/difference",
      "impact/shared-impact",
      "impact/ignored-only",
    ]) {
      const { document } = await designDocument(
        `design/changes/${route}`,
        viewport,
      );
      const title = byClass(document, "mbk-title-row")[0]!;
      assert.equal(byClass(title, "mbk-status").length, 0, route);
      assert.equal(byClass(document, "mbk-review-summary").length, 0, route);
      const inspector = byClass(document, "ce-inspector")[0]!;
      assert.ok(textContent(inspector).includes("Comparison details"), route);
      if (route === "outcomes/added") {
        assert.notEqual(openPanel(document), "info");
        assert.ok(textContent(inspector).includes("Added to this branch."));
      }
      if (route.startsWith("impact/") && viewport === "desktop") {
        const filter = byClass(document, "mbk-nav-filter-opt").filter((node) =>
          (attribute(node, "class") ?? "").split(/\s+/u).includes("active"),
        );
        assert.deepEqual(filter.map(textContent), ["All"]);
        assert.deepEqual(
          byClass(document, "mbk-nav-filter-count").map(textContent),
          ["0"],
        );
      }
      if (route === "outcomes/removed") {
        assert.deepEqual(
          elements(
            document,
            (node) => attribute(node, "data-change-status") !== undefined,
          ).map(textContent),
          ["Removed"],
        );
        assert.ok(
          textContent(document).includes(
            "Farewell was removed from the catalogue.",
          ),
        );
        assert.equal(
          elements(
            document,
            (node) => attribute(node, "aria-label") === "Comparison mode",
          ).length,
          0,
        );
        assert.deepEqual(byClass(document, "mbk-previous").map(textContent), [
          "Showing previous version",
        ]);
        assert.equal(byClass(document, "mbk-empty").length, 0);
        const frame = byClass(
          document,
          viewport === "desktop" ? "browser-frame" : "phone-frame",
        )[0]!;
        assert.ok(textContent(frame).includes("Thanks for looking around"));
      }
    }
  });

  test(`${viewport}: empty Changes retains the current screen`, async () => {
    const { document } = await designDocument(
      "design/changes/impact/empty",
      viewport,
    );
    assert.equal(headTitle(document), "Welcome");
    assert.equal(
      elements(
        document,
        (node) => attribute(node, "aria-label") === "Comparison mode",
      ).length,
      0,
    );
    assert.deepEqual(
      byClass(document, "mbk-nav-filter-count").map(textContent),
      ["0"],
    );
  });
}
