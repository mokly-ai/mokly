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

const loadingScreens = [
  [
    "design-component-usage-loading",
    "design/components/states/loading/usage.html",
  ],
  [
    "design-component-inspection-loading",
    "design/components/states/loading/inspection.html",
  ],
  [
    "design-component-usage-failed",
    "design/components/states/loading/failed.html",
  ],
] as const;

function openPanel(
  document: Parameters<typeof elements>[0],
  panel: "components" | "usage",
): Element {
  const details = elements(
    document,
    (node) =>
      node.tagName === "details" &&
      attribute(node, "data-panel") === panel &&
      attribute(node, "open") === "",
  );
  assert.equal(details.length, 1, `expected open ${panel} panel`);
  const body = byClass(details[0]!, "ce-inspector-panel")[0];
  assert.ok(body);
  return body;
}

function normalizedText(node: Element): string {
  return textContent(node).replace(/\s+/g, " ").trim();
}

test("Loading and recovery is a bounded child of component States", async () => {
  const { manifest } = await designCatalogue;
  const states = manifest.entries.find(
    (entry) => entry.id === "design-component-states",
  );
  const loading = manifest.entries.find(
    (entry) => entry.id === "design-component-loading-states",
  );
  assert.ok(states?.kind === "collection");
  assert.ok(states.childIds.includes("design-component-loading-states"));
  assert.ok(loading?.kind === "collection");
  assert.deepEqual(
    loading.childIds,
    loadingScreens.map(([id]) => id),
  );
  assert.ok(loading.childIds.length <= 5);

  for (const [id, route] of loadingScreens) {
    const entry = manifest.entries.find((entry) => entry.id === id);
    assert.ok(entry?.kind === "screen", id);
    assert.equal(entry.route, route, id);
    assert.equal(entry.darkFragments, undefined, id);
  }
});

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: component Usage has exact loading and failed states`, async () => {
    const loading = await designDocument(
      "design-component-usage-loading",
      viewport,
    );
    const loadingPanel = openPanel(loading.document, "usage");
    assert.equal(normalizedText(loadingPanel), "Loading usage…");
    assert.equal(byClass(loadingPanel, "ce-usage-list").length, 0);
    assert.equal(
      elements(loadingPanel, (node) => node.tagName === "h3").length,
      0,
    );

    const failed = await designDocument(
      "design-component-usage-failed",
      viewport,
    );
    const failedPanel = openPanel(failed.document, "usage");
    assert.deepEqual(
      byClass(failedPanel, "ce-empty-copy").map((node) =>
        textContent(node).trim(),
      ),
      ["Usage couldn’t be loaded."],
    );
    const retry = elements(failedPanel, (node) => node.tagName === "button");
    assert.deepEqual(
      retry.map((node) => textContent(node).trim()),
      ["Try again"],
    );
    assert.equal(attribute(retry[0]!, "disabled"), undefined);
    assert.equal(byClass(failedPanel, "ce-usage-list").length, 0);
  });

  test(`${viewport}: screen inspection waits without claiming empty usage`, async () => {
    const { document } = await designDocument(
      "design-component-inspection-loading",
      viewport,
    );
    const components = openPanel(document, "components");
    assert.equal(
      normalizedText(components),
      "Components Waiting for the component preview.",
    );
    assert.equal(byClass(components, "ce-instance-tree").length, 0);
    assert.equal(byClass(components, "ce-usage-list").length, 0);

    const highlight = byClass(document, "ce-highlight-toggle");
    assert.equal(highlight.length, 1);
    assert.equal(attribute(highlight[0]!, "disabled"), "");
    assert.deepEqual(
      byClass(document, "ce-control-description").map((node) =>
        textContent(node).trim(),
      ),
      ["Waiting for the component preview."],
    );
  });
}
