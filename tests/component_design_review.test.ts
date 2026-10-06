import assert from "node:assert/strict";
import test from "node:test";

import type { ManifestScreen } from "../packages/viewer/dist/registry/types.js";

import {
  attribute,
  byClass,
  designEntries,
  designDocument,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: component current-page links identify the rendered artboard`, async () => {
    const entries = await designEntries(
      (entry): entry is ManifestScreen =>
        entry.kind === "screen" && entry.path.startsWith("design/components/"),
      "component owning artboards",
    );
    assert.equal(entries.length, 39);
    for (const entry of entries) {
      const { document } = await designDocument(entry.path, viewport);
      const current = elements(
        document,
        (node) =>
          node.tagName === "a" && attribute(node, "aria-current") === "page",
      );
      for (const link of current)
        assert.equal(
          attribute(link, "data-mokly-link"),
          entry.path,
          entry.path,
        );
    }
  });

  test(`${viewport}: design-only footer navigation stays outside product artboards`, async () => {
    const entries = await designEntries(
      (entry): entry is ManifestScreen =>
        entry.kind === "screen" && entry.path.startsWith("design/components/"),
      "component footer artboards",
    );
    assert.equal(entries.length, 39);
    for (const entry of entries) {
      const { document } = await designDocument(entry.path, viewport);
      assert.equal(byClass(document, "ce-design-links").length, 0, entry.path);
    }
  });

  test(`${viewport}: component source metadata uses explicit fixture paths`, async () => {
    for (const [id, source] of [
      ["design/components/overview", "components/Action.tsx"],
      ["design/components/pages/toolbar", "components/Toolbar.tsx"],
      ["design/components/pages/help", "components/HelpHint.tsx"],
      ["design/components/states/unused", "components/Badge.tsx"],
      [
        "design/components/pages/stacked/overlay-tall",
        "components/Checklist.tsx",
      ],
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
