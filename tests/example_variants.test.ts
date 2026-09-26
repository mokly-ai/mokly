import assert from "node:assert/strict";
import test from "node:test";

import { designCatalogue } from "./helpers/design_catalogue.js";

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
  assert.equal(variant.route, "screens/example-welcome-empty.html");
  assert.deepEqual(variant.tags, ["forms", "onboarding"]);
  assert.deepEqual(variant.useCaseIds, []);
  assert.deepEqual(variant.fragments, {
    desktop: "screens/example-welcome-empty.desktop.html",
    mobile: "screens/example-welcome-empty.mobile.html",
  });
  assert.ok(variant.darkFragments);
  assert.deepEqual(variant.darkFragments, {
    desktop: "screens/example-welcome-empty.desktop.dark.html",
    mobile: "screens/example-welcome-empty.mobile.dark.html",
  });
  for (const route of [
    ...Object.values(variant.fragments),
    ...Object.values(variant.darkFragments),
  ]) {
    const html = outputs.get(route);
    assert.match(html ?? "", /aria-label="Workspace name"/);
    assert.match(html ?? "", /disabled=""/);
  }
});
