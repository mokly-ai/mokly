import assert from "node:assert/strict";
import test from "node:test";

import { entryRoute } from "@mokly/viewer/data";

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
  ["design/interactive/overview", "Static and Live"],
  ["design/interactive/modes/static", "Preview states"],
  ["design/interactive/modes/preparing", "Preview states"],
  ["design/interactive/modes/unavailable", "Preview states"],
  ["design/interactive/workspace/component", "Component workspace"],
  ["design/interactive/workspace/screen", "Component workspace"],
  ["design/interactive/workspace/static-catalogue", "Component workspace"],
] as const;

/**
 * Rebuild status artboards draw the canonical Welcome screen and the Live
 * component workspace unchanged, so they carry those states' own control.
 */
const REBUILD_STATUS_CARRIERS = [
  "design/rebuild-status/failure",
  "design/rebuild-status/details",
  "design/rebuild-status/updating",
  "design/rebuild-status/failure-updating",
  "design/rebuild-status/live-component",
];

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: the Static and Live gallery owns seven light-only artboards`, async () => {
    for (const [id, folder] of OWNING) {
      const { entry, document } = await designDocument(id, viewport);
      assert.equal(entryRoute(entry.path), `${id}/index.html`);
      assert.equal(
        (await designCatalogue).manifest.folders.find(
          (item) => item.path === entry.path.split("/").slice(0, -1).join("/"),
        )?.title,
        folder,
      );
      assert.deepEqual(entry.colorSchemes, ["light"]);
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
      "design/interactive/overview",
      "design/interactive/modes/static",
      "design/interactive/modes/preparing",
      "design/interactive/modes/unavailable",
      "design/interactive/workspace/component",
      "design/interactive/workspace/screen",
      "design/browse/views/screen",
      "design/components/overview",
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
        "design/browse/views/screen",
        [
          ["Static", true, undefined],
          ["Live", false, "design/interactive/overview"],
        ],
      ],
      [
        "design/interactive/overview",
        [
          ["Static", false, "design/interactive/modes/static"],
          ["Live", true, undefined],
        ],
      ],
      [
        "design/interactive/modes/static",
        [
          ["Static", true, undefined],
          ["Live", false, "design/interactive/modes/preparing"],
        ],
      ],
      [
        "design/interactive/modes/preparing",
        [
          ["Static", false, "design/interactive/modes/static"],
          ["Live", true, undefined],
        ],
      ],
      [
        "design/components/overview",
        [
          ["Static", true, undefined],
          ["Live", false, "design/interactive/workspace/component"],
        ],
      ],
      [
        "design/interactive/workspace/component",
        [
          ["Static", false, "design/components/overview"],
          ["Live", true, undefined],
        ],
      ],
      [
        "design/interactive/workspace/screen",
        [
          ["Static", false, "design/components/inspection/inspection-details"],
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
      "design/interactive/modes/unavailable",
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
      "design/interactive/modes/preparing",
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
    assert.equal(segments(group)[0]?.[2], "design/interactive/modes/static");
  });

  test(`${viewport}: preview mode stays out of every other design artboard`, async () => {
    const { manifest } = await designCatalogue;
    const carriers = new Set([
      "design/browse/views/screen",
      "design/components/overview",
      ...OWNING.map(([id]) => id),
      ...REBUILD_STATUS_CARRIERS,
    ]);
    for (const entry of manifest.entries) {
      if (entry.kind !== "screen" || !entry.path.startsWith("design/"))
        continue;
      if (carriers.has(entry.path)) continue;
      const { document } = await designDocument(entry.path, viewport);
      assert.equal(previewMode(document), undefined, entry.path);
    }
  });
}

test("the Live preview never announces itself inside the device frame", async () => {
  for (const [id, still, frameClasses] of [
    [
      "design/interactive/overview",
      "design/interactive/modes/static",
      ["phone-screen"],
    ],
    [
      "design/interactive/workspace/component",
      "design/components/overview",
      ["ce-canvas"],
    ],
    [
      "design/interactive/workspace/screen",
      "design/components/inspection/inspection-details",
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
