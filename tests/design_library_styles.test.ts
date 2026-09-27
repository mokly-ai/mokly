import assert from "node:assert/strict";
import test from "node:test";

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
    const closed = outputs.get(
      variants.find((variant) => variant.id === "design-ui-top-bar-default")!
        .fragments[viewport],
    )!;
    const opened = outputs.get(
      variants.find((variant) => variant.id === "design-ui-top-bar-tag-picker")!
        .fragments[viewport],
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
  for (const route of Object.values(empty.fragments))
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
