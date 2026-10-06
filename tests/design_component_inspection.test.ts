import assert from "node:assert/strict";
import test from "node:test";

import {
  description,
  named,
  region,
  twoPreviews,
} from "./helpers/design_assertions.js";
import {
  attribute,
  byClass,
  designDocument,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";
import { rowLabel } from "./helpers/design_rows.js";
import { openPanel } from "./helpers/design_stacks.js";

for (const viewport of ["desktop", "mobile"] as const) {
  test(`${viewport}: usage links select the corresponding container or hidden instance`, async () => {
    for (const [route, title, value] of [
      ["toolbar", "Toolbar", "Ready for your next step?"],
      ["help", "Help hint", "false"],
    ] as const) {
      const { document } = await designDocument(
        `design/components/pages/${route}`,
        viewport,
      );
      const target = `design/components/inspection/selection/inspection-${route}`;
      assert.equal(
        attribute(
          named(region(document, "Used by"), "Welcome", "a"),
          "data-mokly-link",
        ),
        target,
      );
      const selection = (await designDocument(target, viewport)).document;
      assert.equal(openPanel(selection), "props");
      const details = textContent(region(selection, "Selected instance"));
      assert.ok(details.includes(title));
      assert.ok(details.includes(value));
      if (route === "help") assert.ok(details.includes("No visible region"));
    }
  });

  test(`${viewport}: a removed consumer keeps independent Changes membership`, async () => {
    for (const id of [
      "design/components/states/removed",
      "design/components/states/removed-consumer",
    ]) {
      const { document } = await designDocument(id, viewport);
      assert.deepEqual(
        byClass(
          document,
          viewport === "desktop" ? "mbk-nav-filter-count" : "ce-change-count",
        ).map(textContent),
        ["2"],
        id,
      );
      if (viewport === "desktop") {
        const nav = byClass(document, "mbk-nav-scroll")[0]!;
        assert.deepEqual(
          elements(nav, (node) => node.tagName === "a").map(rowLabel),
          ["Farewell", "Action", "Compact · Removed"],
        );
        assert.equal(byClass(nav, "mbk-nav-changed").length, 1, id);
      }
    }
  });

  test(`${viewport}: single-component inspection links name the selected instance`, async () => {
    const id = "design/components/inspection/inspection-consumer";
    const { document } = await designDocument(id, viewport);
    for (const preview of twoPreviews(document))
      assert.equal(
        attribute(
          named(preview, "Inspect Action, Continue", "a"),
          "data-mokly-link",
        ),
        id,
      );
    assert.match(
      textContent(region(document, "Selected instance")),
      /Continue/u,
    );
  });

  test(`${viewport}: both previews use unique masks and describe the selected highlight`, async () => {
    for (const route of ["highlight", "nested", "details"]) {
      const { document } = await designDocument(
        `design/components/inspection/inspection-${route}`,
        viewport,
      );
      const ids = elements(document, (node) => node.tagName === "mask").map(
        (node) => attribute(node, "id"),
      );
      for (const preview of twoPreviews(document))
        assert.ok(
          elements(preview, (node) => node.tagName === "mask").length > 0,
          `${route}: each preview has its own masks`,
        );
      assert.ok(ids.length > 0);
      assert.ok(ids.every(Boolean));
      assert.equal(new Set(ids).size, ids.length);
      if (route !== "details")
        assert.ok(
          attribute(
            named(document, "Highlight components", "input"),
            "checked",
          ) !== undefined,
        );
      if (route === "nested") {
        assert.ok(
          attribute(
            elements(
              byClass(document, "ce-instance-tree")[0]!,
              (node) => node.tagName === "details",
            )[0]!,
            "open",
          ) !== undefined,
        );
        assert.match(
          textContent(region(document, "Selected instance")),
          /Toolbar action/u,
        );
      }
    }
  });

  test(`${viewport}: disabled highlighting explains its specific reason`, async () => {
    for (const [route, reason] of [
      ["empty", "No registered components in this view"],
      ["unavailable", "Component inspection is unavailable"],
      ["removed-consumer", "Highlighting is unavailable for removed screens"],
    ] as const) {
      const { document } = await designDocument(
        `design/components/states/${route}`,
        viewport,
      );
      const toggle = named(document, "Highlight components", "input");
      assert.ok(attribute(toggle, "disabled") !== undefined);
      assert.equal(description(toggle, document), reason);
      assert.equal(
        attribute(byClass(document, "ce-highlight-control")[0]!, "title"),
        reason,
      );
    }
    const { document } = await designDocument(
      "design/components/inspection/inspection-details",
      viewport,
    );
    assert.equal(
      attribute(named(document, "Highlight components", "input"), "disabled"),
      undefined,
    );
  });
}
