import assert from "node:assert/strict";
import test from "node:test";

import { designCatalogue } from "./helpers/design_catalogue.js";

test("standalone links follow rendered variants without duplicate hrefs", async () => {
  const { manifest, outputs } = await designCatalogue;
  const topBar = manifest.entries.find(
    (entry) => entry.id === "design-ui-top-bar",
  );
  assert.ok(topBar?.kind === "component");
  const closed = topBar.variants.find((variant) => variant.id === "default")!;
  const opened = topBar.variants.find(
    (variant) => variant.id === "tag-picker",
  )!;
  const hrefs = (html: string) =>
    [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(
      (match) => match[1]!,
    );
  for (const viewport of ["mobile", "desktop"] as const) {
    const defaultLinks = hrefs(outputs.get(closed.fragments[viewport])!);
    const openedLinks = hrefs(outputs.get(opened.fragments[viewport])!);
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

test("empty saved component variant retains its own owner without child styles", async () => {
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

test("standalone variants emit only the exclusive child styles they actually render", async () => {
  const { manifest, outputs } = await designCatalogue;
  const entry = manifest.entries.find(
    (entry) => entry.id === "design-ui-top-bar",
  );
  assert.ok(entry?.kind === "component");
  for (const viewport of ["mobile", "desktop"] as const) {
    const closed = outputs.get(
      entry.variants.find((variant) => variant.id === "default")!.fragments[
        viewport
      ],
    )!;
    const opened = outputs.get(
      entry.variants.find((variant) => variant.id === "tag-picker")!.fragments[
        viewport
      ],
    )!;
    assert.match(closed, /href="[^"]*design-library\/chrome\/top-bar\.css"/);
    assert.doesNotMatch(
      closed,
      /href="[^"]*design-library\/controls\/tag-(chip|picker)\.css"/,
    );
    assert.match(
      opened,
      /href="[^"]*design-library\/controls\/tag-picker\.css"/,
    );
    assert.match(opened, /href="[^"]*design-library\/controls\/tag-chip\.css"/);
  }
  const picker = manifest.entries.find(
    (entry) => entry.id === "design-ui-tag-picker",
  );
  assert.ok(picker?.kind === "component");
  const empty = picker.variants.find((variant) => variant.id === "empty")!;
  for (const route of Object.values(empty.fragments))
    assert.match(
      outputs.get(route)!,
      /href="[^"]*design-library\/controls\/tag-picker\.css"/,
    );
  for (const route of Object.values(empty.fragments))
    assert.doesNotMatch(
      outputs.get(route)!,
      /href="[^"]*design-library\/controls\/tag-chip\.css"/,
    );
});

test("declared CSS belongs to its component in each rendered variant", async () => {
  const { manifest } = await designCatalogue;
  for (const entry of manifest.entries) {
    if (entry.kind !== "component" || !entry.id.startsWith("design-ui-"))
      continue;
    const slug = entry.id.slice("design-ui-".length);
    assert.equal(Object.hasOwn(entry, "ownedDependencies"), false, entry.id);
    for (const variant of entry.variants)
      for (const view of variant.componentViews)
        assert.ok(
          view.resources.some(
            (resource) =>
              resource.path.endsWith(`/` + slug + `.css`) &&
              resource.componentIds.includes(entry.id),
          ),
          `${entry.id}: ${view.viewport}`,
        );
  }
});
