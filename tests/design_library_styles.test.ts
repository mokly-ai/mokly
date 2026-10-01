import assert from "node:assert/strict";
import test from "node:test";

import { generatedViews, viewRoute } from "../packages/viewer/dist/data.js";

import {
  componentParent,
  componentVariants,
} from "./helpers/component_views.js";
import { designCatalogue } from "./helpers/design_catalogue.js";

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
    const closed = outputs.get(
      viewRoute("component", closedVariant.id, viewport, "light"),
    )!;
    const opened = outputs.get(
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
      outputs.get(route)!,
      /href="[^"]*design-library\/controls\/tag-chip\.css"/,
    );
});

test("ownership includes implementation and CSS, while variants stay outside impact dependencies", async () => {
  const { manifest } = await designCatalogue;
  for (const entry of manifest.entries) {
    if (
      entry.kind !== "component" ||
      "variantOf" in entry ||
      !entry.id.startsWith("design-ui-")
    )
      continue;
    const slug = entry.id.slice("design-ui-".length);
    assert.ok(
      entry.ownedDependencies.some((file) =>
        file.endsWith("/" + slug + ".css"),
      ),
      entry.id,
    );
    assert.ok(
      entry.ownedDependencies.some((file) =>
        file.endsWith("/" + slug + ".view.tsx"),
      ),
      entry.id,
    );
    assert.ok(
      !entry.declaredDependencies.some((file) =>
        file.endsWith("/" + slug + ".tsx"),
      ),
      entry.id,
    );
    assert.ok(
      entry.ownedDependencies.every((file) =>
        entry.declaredDependencies.includes(file),
      ),
      entry.id,
    );
  }
});
