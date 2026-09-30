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
    (entry) => entry.kind === "screen" && entry.variantOf === "example-welcome",
  );

  assert.equal(variants.length, 1);
  const [variant] = variants;
  assert.ok(variant?.kind === "screen");
  assert.equal(variant.id, "example-welcome-empty");
  assert.equal(variant.variantOf, "example-welcome");
  assert.equal(
    entryRoute("screen", variant.id),
    "screens/example-welcome-empty.html",
  );
  assert.deepEqual(variant.tags, ["forms", "onboarding"]);
  assert.deepEqual(variant.useCaseIds, []);
  assert.deepEqual(variant.colorSchemes, ["light", "dark"]);
  assert.equal(
    viewRoute("screen", variant.id, "desktop", "light"),
    "screens/example-welcome-empty.desktop.html",
  );
  for (const route of generatedViews(variant).map((view) => view.path)) {
    const html = textOutput(outputs, route);
    assert.match(html ?? "", /aria-label="Workspace name"/);
    assert.match(html ?? "", /disabled=""/);
  }
});
