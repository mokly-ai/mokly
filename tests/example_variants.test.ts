import assert from "node:assert/strict";
import test from "node:test";

import {
  entryRoute,
  generatedViews,
  viewRoute,
} from "../packages/viewer/dist/data.js";

import { designCatalogue } from "./helpers/design_catalogue.js";
import { textOutput } from "./helpers/generated_text.js";

test("example catalogue generates exactly one inherited Welcome variant", async () => {
  const { manifest, outputs } = await designCatalogue;
  const variants = manifest.entries.filter(
    (entry) =>
      entry.kind === "screen" && entry.variantOf === "example/screens/welcome",
  );

  assert.equal(variants.length, 1);
  const [variant] = variants;
  assert.ok(variant?.kind === "screen");
  assert.equal(variant.path, "example/screens/welcome/empty");
  assert.equal(variant.variantOf, "example/screens/welcome");
  assert.equal(
    entryRoute(variant.path),
    "example/screens/welcome/empty/index.html",
  );
  assert.deepEqual(variant.tags, ["forms", "onboarding"]);
  assert.deepEqual(variant.useCasePaths, []);
  assert.deepEqual(variant.colorSchemes, ["light", "dark"]);
  assert.equal(
    viewRoute(variant.path, "desktop", "light"),
    "example/screens/welcome/empty/index.desktop.html",
  );
  for (const route of generatedViews(variant).map((view) => view.path)) {
    const html = textOutput(outputs, route);
    assert.match(html ?? "", /aria-label="Workspace name"/);
    assert.match(html ?? "", /disabled=""/);
  }
});
