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

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: component current-page links identify the rendered artboard`, async () => {
    const { manifest } = await designCatalogue;
    for (const entry of manifest.entries) {
      if (entry.kind !== "screen" || !entry.id.startsWith("design-component-"))
        continue;
      const { document } = await designDocument(entry.id, viewport);
      const current = elements(
        document,
        (node) =>
          node.tagName === "a" && attribute(node, "aria-current") === "page",
      );
      for (const link of current)
        assert.equal(attribute(link, "data-mokly-link"), entry.id, entry.id);
    }
  });

  test(`${viewport}: design-only footer navigation stays outside product artboards`, async () => {
    const { manifest } = await designCatalogue;
    for (const entry of manifest.entries) {
      if (entry.kind !== "screen" || !entry.id.startsWith("design-component-"))
        continue;
      const { document } = await designDocument(entry.id, viewport);
      assert.equal(byClass(document, "ce-design-links").length, 0, entry.id);
    }
  });

  test(`${viewport}: component source metadata uses explicit fixture paths`, async () => {
    for (const [id, source] of [
      ["design-component-overview", "components/Action.tsx"],
      ["design-component-toolbar", "components/Toolbar.tsx"],
      ["design-component-help", "components/HelpHint.tsx"],
      ["design-component-unused", "components/Badge.tsx"],
      ["design-component-overlay-tall", "components/Checklist.tsx"],
    ] as const) {
      const { document } = await designDocument(id, viewport);
      const values = elements(document, (node) => node.tagName === "code").map(
        textContent,
      );
      assert.ok(values.includes(source), `${id}: missing ${source}`);
      assert.ok(!values.includes("components/Helphint.tsx"), id);
    }
  });
}
