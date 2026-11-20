import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { externalizeDocument } from "../scripts/externalize-inline-scripts.js";

function assetPath(body: string): string {
  const digest = createHash("sha256").update(body).digest("hex");
  return `/_astro/inline.${digest}.js`;
}

test("a nested script followed by a shallower script keeps both spans", () => {
  const nested = "globalThis.nested = true;";
  const shallow = "globalThis.shallow = true;";
  const source = [
    "<!doctype html><html><body>",
    `<template><section><script>${nested}</script></section></template>`,
    `<script>${shallow}</script>`,
    "</body></html>",
  ].join("");

  const { assets, output } = externalizeDocument(source);

  assert.ok(output.includes(`src="${assetPath(nested)}"`));
  assert.ok(output.includes(`src="${assetPath(shallow)}"`));
  assert.deepEqual(new Set(assets.values()), new Set([nested, shallow]));
  assert.doesNotMatch(output, /globalThis\.(nested|shallow)/);
});
