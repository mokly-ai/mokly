/** Keep public brand variants and compatibility aliases aligned. */

import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const brandUrl = new URL("../public/brand/", import.meta.url);
const variants = [
  { name: "mokly-logo-light", width: 768, height: 256, density: 384 },
  { name: "mokly-logo-dark", width: 768, height: 256, density: 384 },
  { name: "mokly-icon-light", width: 512, height: 512, density: 768 },
  { name: "mokly-icon-dark", width: 512, height: 512, density: 768 },
];
const aliases = [
  { name: "mokly-logo", source: "mokly-logo-light" },
  { name: "mokly-icon", source: "mokly-icon-light" },
];
const arguments_ = process.argv.slice(2);
assert.ok(
  arguments_.length === 0 ||
    (arguments_.length === 1 && arguments_[0] === "--check"),
  "usage: node scripts/brand-assets.mjs [--check]",
);

const expected = new Map();
for (const variant of variants) {
  const svg = await readFile(new URL(`${variant.name}.svg`, brandUrl));
  const png = await sharp(svg, { density: variant.density })
    .resize(variant.width, variant.height, { fit: "fill" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  expected.set(`${variant.name}.png`, png);
}
for (const alias of aliases) {
  const svg = await readFile(new URL(`${alias.source}.svg`, brandUrl));
  expected.set(`${alias.name}.svg`, svg);
  expected.set(`${alias.name}.png`, expected.get(`${alias.source}.png`));
}

if (arguments_[0] === "--check") {
  for (const [file, contents] of expected) {
    const committed = await readFile(new URL(file, brandUrl));
    assert.ok(
      committed.equals(contents),
      `public/brand/${file} is stale; run npm run brand:build --workspace @mokly-cloud/site`,
    );
  }
  process.stdout.write("site:brand assets match.\n");
} else {
  await Promise.all(
    [...expected].map(([file, contents]) =>
      writeFile(fileURLToPath(new URL(file, brandUrl)), contents),
    ),
  );
  process.stdout.write(`site:brand wrote ${expected.size} derived assets.\n`);
}
