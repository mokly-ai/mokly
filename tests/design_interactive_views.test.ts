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
  LIVE_UNAVAILABLE,
  previewMode,
  segments,
  type DesignNode,
} from "./helpers/design_interactive.js";

const OWNING = [
  ["design-interactive-overview", "design/interactive/overview.html"],
  ["design-interactive-static", "design/interactive/modes/static.html"],
  ["design-interactive-preparing", "design/interactive/modes/preparing.html"],
  [
    "design-interactive-unavailable",
    "design/interactive/modes/unavailable.html",
  ],
  [
    "design-interactive-component",
    "design/interactive/workspace/component.html",
  ],
  ["design-interactive-screen", "design/interactive/workspace/screen.html"],
  [
    "design-interactive-static-catalogue",
    "design/interactive/workspace/static-only.html",
  ],
] as const;

/**
 * Rebuild status artboards draw the canonical Welcome screen and the Live
 * component workspace unchanged, so they carry those states' own control.
 */
const REBUILD_STATUS_CARRIERS = [
  "design-rebuild-failure",
  "design-rebuild-details",
  "design-rebuild-updating",
  "design-rebuild-failure-updating",
  "design-rebuild-live-component",
];

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: the Static and Live gallery owns seven light-only artboards`, async () => {
    for (const [id, route] of OWNING) {
      const { entry, document } = await designDocument(id, viewport);
      assert.equal(entry.route, route);
      assert.equal(entry.darkFragments, undefined);
      assert.equal(byClass(document, "mbk-shell").length, 1, id);
      assert.equal(
        elements(document, (node) => node.tagName === "script").length,
        0,
        id,
      );
    }
  });

  test(`${viewport}: the preview control names its group and both options`, async () => {
    for (const id of [
      "design-interactive-overview",
      "design-interactive-static",
      "design-interactive-preparing",
      "design-interactive-unavailable",
      "design-interactive-component",
      "design-interactive-screen",
      "design-browse-screen",
      "design-component-overview",
    ]) {
      const { document } = await designDocument(id, viewport);
      const group = previewMode(document);
      assert.ok(group, id);
      assert.equal(attribute(group, "role"), "group", id);
      assert.equal(attribute(group, "aria-label"), "Preview mode", id);
      assert.deepEqual(
        segments(group).map(([label]) => label),
        ["Static", `Live${id.endsWith("unavailable") ? LIVE_UNAVAILABLE : ""}`],
        id,
      );
    }
  });

  test(`${viewport}: one segment is selected and the other opens its state`, async () => {
    for (const [id, expected] of [
      [
        "design-browse-screen",
        [
          ["Static", true, undefined],
          ["Live", false, "design-interactive-overview"],
        ],
      ],
      [
        "design-interactive-overview",
        [
          ["Static", false, "design-interactive-static"],
          ["Live", true, undefined],
        ],
      ],
      [
        "design-interactive-static",
        [
          ["Static", true, undefined],
          ["Live", false, "design-interactive-preparing"],
        ],
      ],
      [
        "design-interactive-preparing",
        [
          ["Static", false, "design-interactive-static"],
          ["Live", true, undefined],
        ],
      ],
      [
        "design-component-overview",
        [
          ["Static", true, undefined],
          ["Live", false, "design-interactive-component"],
        ],
      ],
      [
        "design-interactive-component",
        [
          ["Static", false, "design-component-overview"],
          ["Live", true, undefined],
        ],
      ],
      [
        "design-interactive-screen",
        [
          ["Static", false, "design-component-inspection-details"],
          ["Live", true, undefined],
        ],
      ],
    ] as const) {
      const { document } = await designDocument(id, viewport);
      const group = previewMode(document);
      assert.ok(group, id);
      assert.deepEqual(segments(group), expected, id);
    }
  });

  test(`${viewport}: an unavailable live preview describes itself without a link`, async () => {
    const { document } = await designDocument(
      "design-interactive-unavailable",
      viewport,
    );
    const group = previewMode(document);
    assert.ok(group);
    const live = byClass(group, "ce-preview-mode-off")[0];
    assert.ok(live);
    assert.equal(live.tagName, "span");
    assert.equal(attribute(live, "aria-disabled"), "true");
    assert.equal(attribute(live, "title"), LIVE_UNAVAILABLE);
    assert.equal(attribute(live, "data-mokly-link"), undefined);
    assert.equal(attribute(live, "href"), undefined);
    const described = attribute(live, "aria-describedby");
    assert.ok(described);
    const description = elements(
      group,
      (node) => attribute(node, "id") === described,
    )[0];
    assert.ok(description);
    assert.equal(textContent(description), LIVE_UNAVAILABLE);
    assert.deepEqual(
      segments(group).map(([, selected]) => selected),
      [true, false],
    );
  });

  test(`${viewport}: preparing waits inside the device frame and keeps Static`, async () => {
    const { document } = await designDocument(
      "design-interactive-preparing",
      viewport,
    );
    const states = byClass(document, "mbk-preview-state");
    assert.equal(states.length, 2);
    for (const state of states) {
      assert.equal(byClass(state, "mbk-preview-spinner").length, 1);
      assert.match(textContent(state), /Getting the live preview ready/);
    }
    assert.equal(
      byClass(document, "phone-screen").filter(
        (node) => byClass(node, "mbk-preview-state").length === 1,
      ).length,
      1,
    );
    assert.equal(
      byClass(document, "browser-viewport").filter(
        (node) => byClass(node, "mbk-preview-state").length === 1,
      ).length,
      1,
    );
    const group = previewMode(document);
    assert.ok(group);
    assert.equal(segments(group)[0]?.[2], "design-interactive-static");
  });

  test(`${viewport}: preview mode stays out of every other design artboard`, async () => {
    const { manifest } = await designCatalogue;
    const carriers = new Set([
      "design-browse-screen",
      "design-component-overview",
      ...OWNING.map(([id]) => id),
      ...REBUILD_STATUS_CARRIERS,
    ]);
    for (const entry of manifest.entries) {
      if (entry.kind !== "screen" || !entry.id.startsWith("design-")) continue;
      if (carriers.has(entry.id)) continue;
      const { document } = await designDocument(entry.id, viewport);
      assert.equal(previewMode(document), undefined, entry.id);
    }
  });
}

test("the Live preview never announces itself inside the device frame", async () => {
  for (const [id, still, frameClasses] of [
    [
      "design-interactive-overview",
      "design-interactive-static",
      ["phone-screen"],
    ],
    [
      "design-interactive-component",
      "design-component-overview",
      ["ce-canvas"],
    ],
    [
      "design-interactive-screen",
      "design-component-inspection-details",
      ["phone-screen", "browser-viewport"],
    ],
  ] as const)
    for (const viewport of ["mobile", "desktop"] as const) {
      const frames = (document: DesignNode) =>
        frameClasses
          .flatMap((frameClass) => byClass(document, frameClass))
          .map(textContent)
          .join("|");
      const live = frames((await designDocument(id, viewport)).document);
      assert.ok(live.length > 0, id);
      assert.equal(
        live,
        frames((await designDocument(still, viewport)).document),
        id,
      );
    }
});
