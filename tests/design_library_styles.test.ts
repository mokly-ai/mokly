import assert from "node:assert/strict";
import test from "node:test";

import { generatedViews, viewRoute } from "../packages/viewer/dist/data.js";

import {
  componentParent,
  componentVariants,
} from "./helpers/component_views.js";
import { designCatalogue } from "./helpers/design_catalogue.js";
import { textOutput } from "./helpers/generated_text.js";

test("standalone links follow rendered variants without duplicate hrefs", async () => {
  const { manifest, outputs } = await designCatalogue;
  const topBar = manifest.entries.find(
    (entry) => entry.id === "design-ui-top-bar",
  );
  assert.ok(topBar?.kind === "component");
  const closed = componentVariants(manifest, topBar.id).find(
    (variant) => variant.id === "design-ui-top-bar-default",
  )!;
  const opened = componentVariants(manifest, topBar.id).find(
    (variant) => variant.id === "design-ui-top-bar-tag-picker",
  )!;
  const hrefs = (html: string) =>
    [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(
      (match) => match[1]!,
    );
  for (const viewport of ["mobile", "desktop"] as const) {
    const defaultLinks = hrefs(
      textOutput(
        outputs,
        viewRoute("component", closed.id, viewport, "light"),
      )!,
    );
    const openedLinks = hrefs(
      textOutput(
        outputs,
        viewRoute("component", opened.id, viewport, "light"),
      )!,
    );
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

test("empty saved component variant retains its own link provenance without child styles", async () => {
  const { manifest, outputs } = await designCatalogue;
  const picker = manifest.entries.find(
    (entry) => entry.id === "design-ui-tag-picker",
  );
  assert.ok(picker?.kind === "component");
  const empty = componentVariants(manifest, picker.id).find(
    (variant) => variant.id === "design-ui-tag-picker-empty",
  )!;
  for (const viewport of ["mobile", "desktop"] as const) {
    const html = textOutput(
      outputs,
      viewRoute("component", empty.id, viewport, "light"),
    )!;
    assert.match(html, /href="[^"]*\/controls\/tag-picker\.css"/);
    assert.doesNotMatch(html, /href="[^"]*\/controls\/tag-chip\.css"/);
    assert.deepEqual(
      empty.componentViews
        .find((view) => view.viewport === viewport)!
        .insertedStylesheets!.map(({ path, componentIds }) => ({
          path,
          componentIds,
        })),
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
  const entry = componentParent(manifest, "design-ui-top-bar");
  const variants = componentVariants(manifest, entry.id);
  for (const viewport of ["mobile", "desktop"] as const) {
    const closedVariant = variants.find(
      (variant) => variant.id === "design-ui-top-bar-default",
    )!;
    const openedVariant = variants.find(
      (variant) => variant.id === "design-ui-top-bar-tag-picker",
    )!;
    const closed = textOutput(
      outputs,
      viewRoute("component", closedVariant.id, viewport, "light"),
    )!;
    const opened = textOutput(
      outputs,
      viewRoute("component", openedVariant.id, viewport, "light"),
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
  const picker = componentParent(manifest, "design-ui-tag-picker");
  const empty = componentVariants(manifest, picker.id).find(
    (variant) => variant.id === "design-ui-tag-picker-empty",
  )!;
  for (const route of generatedViews(empty).map((view) => view.path))
    assert.doesNotMatch(
      textOutput(outputs, route)!,
      /href="[^"]*design-library\/controls\/tag-chip\.css"/,
    );
});

test("declared CSS records its declaring component in each inserted variant link", async () => {
  const { manifest } = await designCatalogue;
  for (const entry of manifest.entries) {
    if (
      entry.kind !== "component" ||
      "variantOf" in entry ||
      !entry.id.startsWith("design-ui-")
    )
      continue;
    const slug = entry.id.slice("design-ui-".length);
    assert.equal(Object.hasOwn(entry, "ownedDependencies"), false, entry.id);
    for (const variant of componentVariants(manifest, entry.id))
      for (const view of variant.componentViews)
        assert.ok(
          view.insertedStylesheets!.some(
            (resource) =>
              resource.path.endsWith(`/` + slug + `.css`) &&
              resource.componentIds.includes(entry.id),
          ),
          `${entry.id}: ${view.viewport}`,
        );
  }
});
