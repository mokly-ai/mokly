import assert from "node:assert/strict";
import test from "node:test";

import {
  attribute,
  byClass,
  designCatalogue,
  designDocument,
  elements,
  textContent,
  type Element,
} from "./helpers/design_catalogue.js";

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
  [
    "design-interactive-static-catalogue",
    "design/interactive/workspace/static-only.html",
  ],
] as const;

const LIVE_UNAVAILABLE = "Live preview is unavailable for this view.";
const STATIC_NOTICE = "Switch to Static to inspect or edit this view.";

function previewMode(
  document: Parameters<typeof byClass>[0],
): Element | undefined {
  return byClass(document, "ce-preview-mode")[0];
}

/** Every segment in order, with its selected state and authored destination. */
function segments(group: Element) {
  return group.childNodes
    .filter((node): node is Element => "tagName" in node)
    .map((node) => [
      textContent(node).trim(),
      (attribute(node, "class") ?? "").split(/\s+/).includes("active"),
      attribute(node, "data-mokly-link"),
    ]);
}

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: the Static and Live gallery owns six light-only artboards`, async () => {
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

  test(`${viewport}: the live workspace points inspection and highlighting back to Static`, async () => {
    const { document } = await designDocument(
      "design-interactive-component",
      viewport,
    );
    const notices = byClass(document, "ce-muted").filter(
      (node) => textContent(node) === STATIC_NOTICE,
    );
    assert.equal(notices.length, 2);
    const panels = notices.map((node) => {
      const owner = elements(
        document,
        (element) =>
          attribute(element, "class") === "ce-inspector-panel" &&
          elements(element, (child) => child === node).length > 0,
      )[0];
      return attribute(owner!, "aria-label");
    });
    assert.deepEqual(panels.sort(), ["Props", "Usage"]);
    assert.match(textContent(document), /About Action/);
    const highlight = byClass(document, "ce-highlight-toggle")[0];
    assert.ok(highlight);
    assert.equal(attribute(highlight, "disabled"), "");
    const reason = attribute(highlight, "aria-describedby");
    assert.ok(reason);
    assert.equal(
      textContent(
        elements(document, (node) => attribute(node, "id") === reason)[0]!,
      ),
      "Highlighting works in Static.",
    );
  });

  test(`${viewport}: a catalogue without Live keeps its toolbar unchanged`, async () => {
    const { document } = await designDocument(
      "design-interactive-static-catalogue",
      viewport,
    );
    assert.equal(previewMode(document), undefined);
    assert.equal(byClass(document, "ce-preview-mode-off").length, 0);
    const toolbar = elements(
      document,
      (node) => attribute(node, "aria-label") === "Preview options",
    )[0];
    assert.ok(toolbar);
    assert.equal(byClass(toolbar, "mbk-seg").length, 0);
    assert.doesNotMatch(textContent(toolbar), /Static|Live/);
    assert.deepEqual(
      toolbar.childNodes
        .filter((node): node is Element => "tagName" in node)
        .map((node) => attribute(node, "class")?.split(/\s+/)[1]),
      ["ce-viewport-control", "ce-theme-control", "ce-highlight-control"],
    );
    const highlight = byClass(document, "ce-highlight-toggle")[0];
    assert.ok(highlight);
    assert.equal(attribute(highlight, "disabled"), undefined);
  });

  test(`${viewport}: preview mode stays out of every other design artboard`, async () => {
    const { manifest } = await designCatalogue;
    const carriers = new Set([
      "design-browse-screen",
      "design-component-overview",
      ...OWNING.map(([id]) => id),
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
  for (const id of [
    "design-interactive-overview",
    "design-interactive-component",
  ])
    for (const viewport of ["mobile", "desktop"] as const) {
      const live = await designDocument(id, viewport);
      const still = await designDocument(
        id === "design-interactive-overview"
          ? "design-interactive-static"
          : "design-component-overview",
        viewport,
      );
      const frames = (document: typeof live.document) =>
        byClass(
          document,
          id === "design-interactive-overview" ? "phone-screen" : "ce-canvas",
        )
          .map(textContent)
          .join("|");
      assert.equal(frames(live.document), frames(still.document), id);
    }
});
