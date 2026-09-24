import assert from "node:assert/strict";
import test from "node:test";

import { designCatalogue } from "./helpers/design_catalogue.js";

test("standalone component styles are derived from each rendered variant", async () => {
  const { manifest, outputs } = await designCatalogue;
  const topBar = manifest.entries.find(
    (entry) => entry.id === "design-ui-top-bar",
  );
  assert.ok(topBar?.kind === "component");
  const closed = topBar.variants.find((variant) => variant.id === "default")!;
  const opened = topBar.variants.find(
    (variant) => variant.id === "tag-picker",
  )!;
  const files = (html: string): string[] =>
    [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(
      (match) => match[1]!,
    );
  for (const viewport of ["mobile", "desktop"] as const) {
    const defaultLinks = files(outputs.get(closed.fragments[viewport])!);
    const openedLinks = files(outputs.get(opened.fragments[viewport])!);
    assert.equal(defaultLinks.length, new Set(defaultLinks).size);
    assert.equal(openedLinks.length, new Set(openedLinks).size);
    assert.ok(
      defaultLinks.some((file) => file.endsWith("/chrome/top-bar.css")),
    );
    assert.ok(
      defaultLinks.every((file) => !file.endsWith("/controls/tag-chip.css")),
    );
    assert.ok(
      openedLinks.some((file) => file.endsWith("/controls/tag-chip.css")),
    );
    assert.ok(
      openedLinks.some((file) => file.endsWith("/controls/tag-picker.css")),
    );
  }
});

test("empty registered components still link their own stylesheet without linking children", async () => {
  const { manifest, outputs } = await designCatalogue;
  const picker = manifest.entries.find(
    (entry) => entry.id === "design-ui-tag-picker",
  );
  assert.ok(picker?.kind === "component");
  const empty = picker.variants.find((variant) => variant.id === "empty")!;
  for (const viewport of ["mobile", "desktop"] as const) {
    const html = outputs.get(empty.fragments[viewport])!;
    assert.match(html, /href="[^"]*\/controls\/tag-picker\.css"/);
    assert.doesNotMatch(html, /href="[^"]*\/controls\/tag-chip\.css"/);
    assert.deepEqual(
      empty.componentViews.find((view) => view.viewport === viewport)!
        .resources,
      [
        {
          path: "design-library/controls/tag-picker.css",
          componentIds: ["design-ui-tag-picker"],
        },
      ],
    );
  }
});
