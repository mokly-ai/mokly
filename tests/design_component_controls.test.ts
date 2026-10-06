import assert from "node:assert/strict";
import test from "node:test";

import {
  description,
  fieldValue,
  named,
  region,
} from "./helpers/design_assertions.js";
import {
  attribute,
  byClass,
  designDocument,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";

for (const viewport of ["desktop", "mobile"] as const) {
  test(`${viewport}: controls keep saved, edited, reset, and disabled states`, async () => {
    const variants = (
      await designDocument("design/components/pages/variants", viewport)
    ).document;
    const edit = elements(
      variants,
      (node) =>
        node.tagName === "a" && textContent(node).includes("Edit props"),
    );
    assert.equal(edit.length, 1);
    assert.equal(
      attribute(edit[0]!, "data-mokly-link"),
      "design/components/controls/editing/variant",
    );
    const initial = (
      await designDocument("design/components/controls/controls", viewport)
    ).document;
    const controls = region(initial, "Controls");
    for (const [name, tag, value] of [
      ["label", "input", "Continue"],
      ["cornerRadius", "input", "8"],
      ["emphasis", "select", "strong"],
    ])
      assert.equal(fieldValue(named(controls, name!, tag)), value);
    assert.equal(
      attribute(named(controls, "disabled", "input"), "checked"),
      undefined,
    );
    assert.ok(
      attribute(named(controls, "Set hint", "input"), "checked") !== undefined,
    );
    for (const [state, value] of [
      ["edited", "Get started"],
      ["reset", "Continue"],
    ]) {
      const { document } = await designDocument(
        `design/components/controls/editing/${state}`,
        viewport,
      );
      assert.equal(
        fieldValue(named(region(document, "Controls"), "label", "input")),
        value,
      );
      for (const preview of byClass(document, "ce-preview-view"))
        assert.deepEqual(byClass(preview, "ce-action").map(textContent), [
          value,
        ]);
      if (state === "edited")
        assert.equal(
          attribute(
            named(region(document, "Controls"), "Reset to Default", "a"),
            "data-mokly-link",
          ),
          "design/components/controls/editing/reset",
        );
      else
        assert.equal(
          attribute(
            named(named(document, "Saved variants", "nav"), "Disabled", "a"),
            "data-mokly-link",
          ),
          "design/components/controls/editing/variant",
        );
    }
    for (const state of ["editing/variant", "published/readonly-variant"]) {
      const { document } = await designDocument(
        `design/components/controls/${state}`,
        viewport,
      );
      for (const preview of byClass(document, "ce-preview-view")) {
        const action = byClass(preview, "ce-action");
        assert.equal(action.length, 1);
        assert.ok(attribute(action[0]!, "disabled") !== undefined);
      }
      if (state === "editing/variant")
        assert.ok(
          attribute(
            named(region(document, "Controls"), "disabled", "input"),
            "checked",
          ) !== undefined,
        );
    }
  });

  test(`${viewport}: invalid and pending controls retain their error and saved preview`, async () => {
    const { document } = await designDocument(
      "design/components/controls/states/invalid",
      viewport,
    );
    const radius = named(region(document, "Controls"), "cornerRadius", "input");
    assert.equal(attribute(radius, "aria-invalid"), "true");
    assert.equal(description(radius, document), "Enter a number from 0 to 24.");
    for (const preview of byClass(document, "ce-preview-view"))
      assert.match(
        attribute(byClass(preview, "ce-action")[0]!, "style") ?? "",
        /(?:^|;)\s*border-radius:\s*8px(?:;|$)/u,
      );
    const error = (
      await designDocument("design/components/controls/states/error", viewport)
    ).document;
    const alerts = elements(
      error,
      (node) => attribute(node, "role") === "alert",
    );
    assert.equal(alerts.length, 1);
    assert.match(textContent(alerts[0]!), /Couldn’t update this component/u);
    assert.equal(
      attribute(named(error, "Try again", "a"), "data-mokly-link"),
      "design/components/controls/states/pending",
    );
    const pending = (
      await designDocument(
        "design/components/controls/states/pending",
        viewport,
      )
    ).document;
    for (const preview of byClass(pending, "ce-preview-view")) {
      const status = elements(
        preview,
        (node) => attribute(node, "role") === "status",
      );
      assert.equal(status.length, 1);
      assert.match(textContent(status[0]!), /Updating preview/u);
    }
  });

  test(`${viewport}: unset, comparison, and published controls keep their boundaries`, async () => {
    const unset = (
      await designDocument("design/components/controls/editing/unset", viewport)
    ).document;
    assert.equal(
      attribute(named(unset, "Set hint", "input"), "checked"),
      undefined,
    );
    for (const [path, copy] of [
      ["states/comparison", "Switch to Current to edit props."],
      ["published/readonly", "Open this catalogue locally to edit props."],
      [
        "published/readonly-variant",
        "Open this catalogue locally to edit props.",
      ],
    ] as const) {
      const { document } = await designDocument(
        `design/components/controls/${path}`,
        viewport,
      );
      const controls = region(document, "Controls");
      assert.ok(textContent(controls).includes(copy), path);
      assert.equal(
        elements(controls, (node) => ["input", "select"].includes(node.tagName))
          .length,
        0,
        path,
      );
      if (path === "states/comparison")
        assert.equal(
          attribute(
            named(controls, "Switch to Current", "a"),
            "data-mokly-link",
          ),
          "design/components/controls/controls",
        );
      if (path === "published/readonly")
        assert.equal(
          attribute(
            named(named(document, "Saved variants", "nav"), "Disabled", "a"),
            "data-mokly-link",
          ),
          "design/components/controls/published/readonly-variant",
        );
    }
  });
}
