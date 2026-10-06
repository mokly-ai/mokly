import assert from "node:assert/strict";
import test from "node:test";

import { generatedViews, viewRoute } from "../packages/viewer/dist/data.js";

import { entriesUnder } from "./helpers/catalogue_selection.js";
import {
  componentParent,
  componentVariants,
} from "./helpers/component_views.js";
import { designCatalogue } from "./helpers/design_catalogue.js";
import { textOutput } from "./helpers/generated_text.js";

test("standalone variants emit only the exclusive child styles they actually render", async () => {
  const { manifest, outputs } = await designCatalogue;
  const entry = componentParent(manifest, "design/library/chrome/top-bar");
  const variants = componentVariants(manifest, entry.path);
  for (const viewport of ["mobile", "desktop"] as const) {
    const closedVariant = variants.find(
      (variant) => variant.path === "design/library/chrome/top-bar/default",
    )!;
    const openedVariant = variants.find(
      (variant) => variant.path === "design/library/chrome/top-bar/tag-picker",
    )!;
    const closed = textOutput(
      outputs,
      viewRoute(closedVariant.path, viewport, "light"),
    )!;
    const opened = textOutput(
      outputs,
      viewRoute(openedVariant.path, viewport, "light"),
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
  const picker = componentParent(
    manifest,
    "design/library/controls/tag-picker",
  );
  const empty = componentVariants(manifest, picker.path).find(
    (variant) => variant.path === "design/library/controls/tag-picker/empty",
  )!;
  for (const route of generatedViews(empty).map((view) => view.path))
    assert.doesNotMatch(
      textOutput(outputs, route)!,
      /href="[^"]*design-library\/controls\/tag-chip\.css"/,
    );
});

test("ownership includes implementation and CSS, while variants stay outside impact dependencies", async () => {
  const { manifest } = await designCatalogue;
  const entries = entriesUnder(manifest, "design/library", {
    kind: "component",
    variants: "exclude",
  });
  for (const entry of entries) {
    const slug = entry.path.slice(entry.path.lastIndexOf("/") + 1);
    assert.ok(
      entry.ownedDependencies.some((file) =>
        file.endsWith("/" + slug + ".css"),
      ),
      entry.path,
    );
    assert.ok(
      entry.ownedDependencies.some((file) =>
        file.endsWith("/" + slug + ".view.tsx"),
      ),
      entry.path,
    );
    assert.ok(
      !entry.declaredDependencies.some((file) =>
        file.endsWith("/" + slug + ".tsx"),
      ),
      entry.path,
    );
    assert.ok(
      entry.ownedDependencies.every((file) =>
        entry.declaredDependencies.includes(file),
      ),
      entry.path,
    );
  }
});
