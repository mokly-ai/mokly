import assert from "node:assert/strict";
import test from "node:test";

import type { ManifestScreen } from "../packages/viewer/dist/registry/types.js";

import {
  fieldValue,
  named,
  namedRole,
  region,
  twoPreviews,
} from "./helpers/design_assertions.js";
import {
  attribute,
  byClass,
  designDocument,
  designEntries,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";
import { headTitle, rowLabel } from "./helpers/design_rows.js";

for (const viewport of ["desktop", "mobile"] as const) {
  test(`${viewport}: every owning component artboard has its shell and heading`, async () => {
    const entries = await designEntries(
      (entry): entry is ManifestScreen =>
        entry.kind === "screen" && entry.path.startsWith("design/components/"),
      "component owning artboards",
    );
    assert.equal(entries.length, 39);
    for (const entry of entries) {
      const { document } = await designDocument(entry.path, viewport);
      const design = byClass(document, "ce-design");
      assert.equal(design.length, 1, entry.path);
      assert.equal(
        byClass(design[0]!, `mbk-shell--${viewport}`).length,
        1,
        entry.path,
      );
      assert.ok(headTitle(document), entry.path);
      const head = byClass(document, "mbk-screen-head")[0]!;
      assert.equal(
        elements(head, (node) => node.tagName === "h2").length,
        1,
        entry.path,
      );
      assert.equal(
        namedRole(document, "navigation", /related design pages/iu).length,
        0,
        entry.path,
      );
    }
  });

  test(`${viewport}: saved variants and usage links identify their owning pages`, async () => {
    const { document } = await designDocument(
      "design/components/overview",
      viewport,
    );
    const variants = named(document, "Saved variants", "nav");
    assert.equal(
      attribute(named(variants, "Disabled", "a"), "data-mokly-link"),
      "design/components/pages/variants",
    );
    assert.equal(
      byClass(document, "phone-frame").length +
        byClass(document, "browser-frame").length,
      0,
    );
    assert.equal(
      fieldValue(named(document, "Preview viewport", "select")),
      viewport,
    );
    const disabled = (
      await designDocument("design/components/pages/variants", viewport)
    ).document;
    for (const preview of twoPreviews(disabled)) {
      assert.ok(
        attribute(named(preview, "Continue", "button"), "disabled") !==
          undefined,
      );
    }
    assert.match(textContent(named(disabled, "Supplied props", "dl")), /true/u);
    assert.equal(
      attribute(
        named(region(disabled, "Used by"), "Welcome", "a"),
        "data-mokly-link",
      ),
      "design/components/inspection/inspection-details",
    );
    const selected = (
      await designDocument(
        "design/components/inspection/inspection-details",
        viewport,
      )
    ).document;
    assert.equal(headTitle(selected), "Welcome");
    assert.match(
      textContent(region(selected, "Selected instance")),
      /Footer action/u,
    );
  });

  test(`${viewport}: component-only and independent changes keep their membership`, async () => {
    for (const [id, count, rows] of [
      ["design/components/pages/affected", "1", ["Action", "Default"]],
      [
        "design/components/inspection/inspection-direct-change",
        "2",
        ["Welcome", "Action", "Default"],
      ],
    ] as const) {
      const { document } = await designDocument(id, viewport);
      assert.deepEqual(
        byClass(
          document,
          viewport === "desktop" ? "mbk-nav-filter-count" : "ce-change-count",
        ).map(textContent),
        [count],
      );
      if (viewport === "desktop") {
        const nav = byClass(document, "mbk-nav-scroll")[0]!;
        assert.deepEqual(
          elements(nav, (node) => node.tagName === "a").map(rowLabel),
          [...rows],
        );
        assert.equal(byClass(nav, "mbk-nav-changed").length, 2);
      }
      if (id.endsWith("affected")) {
        assert.equal(
          elements(
            region(document, "Affected screens"),
            (node) => node.tagName === "a",
          ).length,
          2,
        );
        const group = named(document, "Comparison mode");
        assert.equal(
          attribute(named(group, "Current", "button"), "aria-pressed"),
          "true",
        );
      } else
        assert.match(
          textContent(
            byClass(region(document, "Selected instance"), "ce-props")[0]!,
          ),
          /Get started/u,
        );
    }
  });
}
