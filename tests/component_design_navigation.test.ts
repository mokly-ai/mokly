import assert from "node:assert/strict";
import test from "node:test";

import {
  COMPONENT_PAGES,
  CONTROLS_PAGES,
  INSPECTION_PAGES,
} from "../examples/basic/specs/design/components/parts/destinations.js";
import { actionModes } from "../examples/basic/specs/design/components/parts/navigation_states.js";

import { named, namedRole } from "./helpers/design_assertions.js";
import {
  attribute,
  byClass,
  designDocument,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";

/** Mode labels of the comparison control, keyed by the family's modes. */
const MODE_LABELS = {
  current: "Current",
  "side-by-side": "Side by side",
  overlay: "Overlay",
  difference: "Difference",
} as const;

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: component controls preserve their own scenario after shell integration`, async () => {
    const destinations = [
      ...Object.values(COMPONENT_PAGES),
      ...Object.values(CONTROLS_PAGES),
      ...Object.values(INSPECTION_PAGES),
    ];
    assert.equal(new Set(destinations).size, 39);
    const family = new Map<string, keyof typeof MODE_LABELS>(
      Object.entries(actionModes).map(([mode, id]) => [
        id,
        mode as keyof typeof MODE_LABELS,
      ]),
    );
    for (const id of destinations) {
      const { document } = await designDocument(id, viewport);
      assert.equal(
        attribute(byClass(document, "mbk-brand")[0]!, "data-mokly-link"),
        "design/browse/views/home",
        id,
      );
      const toolbar = byClass(document, "mbk-cmp-toolbar")[0];
      const changed = new Set<string>([
        COMPONENT_PAGES.affected,
        COMPONENT_PAGES.added,
        COMPONENT_PAGES.comparison,
        COMPONENT_PAGES.overlay,
        COMPONENT_PAGES.difference,
        COMPONENT_PAGES["overlay-tall"],
        COMPONENT_PAGES.removed,
        CONTROLS_PAGES.comparison,
        INSPECTION_PAGES["direct-change"],
        INSPECTION_PAGES["removed-consumer"],
      ]).has(id);
      const comparable =
        changed &&
        id !== COMPONENT_PAGES.added &&
        id !== INSPECTION_PAGES["removed-consumer"];
      assert.equal(
        byClass(document, "ce-unmodified").length,
        changed ? 0 : 1,
        id,
      );
      const active = family.get(id);
      if (active) {
        assert.ok(toolbar, id);
        assert.deepEqual(
          elements(toolbar, (node) => node.tagName === "a").map((link) => [
            textContent(link).trim(),
            attribute(link, "data-mokly-link"),
          ]),
          Object.entries(actionModes)
            .filter(([mode]) => mode !== active)
            .map(([mode, target]) => [
              MODE_LABELS[mode as keyof typeof MODE_LABELS],
              target,
            ]),
          `${id}: the family's other modes link to their own artboards`,
        );
        const buttons = elements(toolbar, (node) => node.tagName === "button");
        assert.deepEqual(
          buttons.map((node) => [
            textContent(node).trim(),
            attribute(node, "aria-pressed"),
          ]),
          [[MODE_LABELS[active], "true"]],
          id,
        );
      } else if (comparable) {
        assert.ok(toolbar, id);
        assert.equal(
          elements(toolbar, (node) => node.tagName === "a").length,
          0,
        );
        const buttons = elements(toolbar, (node) => node.tagName === "button");
        assert.equal(buttons.length, 4, id);
        assert.equal(
          buttons.filter((node) => attribute(node, "aria-pressed") === "true")
            .length,
          1,
          id,
        );
      } else {
        assert.equal(toolbar, undefined, id);
        assert.equal(
          namedRole(document, "group", "Comparison mode").length,
          0,
          id,
        );
      }
      assert.equal(
        attribute(byClass(document, "mbk-search-tag")[0]!, "href"),
        undefined,
        id,
      );
      if (viewport === "mobile") {
        assert.equal(
          attribute(byClass(document, "mbk-menu-btn")[0]!, "data-mokly-link"),
          "design/browse/states/navigation",
          id,
        );
      }
    }
  });

  test(`${viewport}: preview options own the viewport control and Light canvas labels`, async () => {
    const { document } = await designDocument(
      "design/components/controls/editing/edited",
      viewport,
    );
    const toolbar = named(document, "Preview options");
    assert.equal(attribute(toolbar, "role"), "toolbar");
    assert.ok(named(toolbar, "Preview viewport", "select"));
    assert.deepEqual(byClass(document, "ce-scheme").map(textContent), [
      "Light",
      "Light",
    ]);
    const top = byClass(document, "mbk-topbar")[0]!;
    assert.equal(byClass(top, "mbk-seg").length, 0);
    assert.equal(byClass(top, "ce-view-controls").length, 0);
    assert.equal(byClass(document, "ce-inspection-toolbar").length, 0);
  });
}
