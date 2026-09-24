import assert from "node:assert/strict";
import test from "node:test";

import { designCatalogue } from "./helpers/design_catalogue.js";
import { textOutput } from "./helpers/generated_text.js";

test("example catalogue generates exactly one inherited Welcome variant", async () => {
  const { manifest, outputs } = await designCatalogue;
  const variants = manifest.entries.filter(
    (entry) => entry.kind === "screen" && entry.variantOf !== undefined,
  );

  assert.equal(variants.length, 1);
  const [variant] = variants;
  assert.ok(variant?.kind === "screen");
  assert.equal(variant.id, "example-welcome-empty");
  assert.equal(variant.variantOf, "example-welcome");
  assert.equal(variant.route, "screens/welcome.variants/empty.html");
  assert.deepEqual(variant.tags, ["forms", "onboarding"]);
  assert.deepEqual(variant.useCaseIds, []);
  assert.deepEqual(variant.fragments, {
    desktop: "screens/welcome.variants/empty.desktop.html",
    mobile: "screens/welcome.variants/empty.mobile.html",
  });
  assert.ok(variant.darkFragments);
  assert.deepEqual(variant.darkFragments, {
    desktop: "screens/welcome.variants/empty.desktop.dark.html",
    mobile: "screens/welcome.variants/empty.mobile.dark.html",
  });
  for (const route of [
    ...Object.values(variant.fragments),
    ...Object.values(variant.darkFragments),
  ]) {
    const html = textOutput(outputs, route);
    assert.match(html ?? "", /aria-label="Workspace name"/);
    assert.match(html ?? "", /disabled=""/);
  }
});
