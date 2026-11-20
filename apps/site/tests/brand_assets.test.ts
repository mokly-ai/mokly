import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { tokens } from "@mokly-cloud/tokens/tokens";
import sharp from "sharp";

import { sitePath } from "../src/workspace.js";

const assetPath = (...segments: readonly string[]) =>
  sitePath("public", "brand", ...segments);

const variants = [
  {
    name: "mokly-logo-light",
    svgSize: [192, 64],
    pngSize: [768, 256],
    colors: [
      tokens.color.light.accent,
      tokens.color.light.text,
      tokens.color.light.surface,
    ],
  },
  {
    name: "mokly-logo-dark",
    svgSize: [192, 64],
    pngSize: [768, 256],
    colors: [
      tokens.color.dark.accent,
      tokens.color.dark.text,
      tokens.color.dark.surface,
    ],
  },
  {
    name: "mokly-icon-light",
    svgSize: [64, 64],
    pngSize: [512, 512],
    colors: [tokens.color.light.accent, tokens.color.light.surface],
  },
  {
    name: "mokly-icon-dark",
    svgSize: [64, 64],
    pngSize: [512, 512],
    colors: [tokens.color.dark.accent, tokens.color.dark.surface],
  },
] as const;
const aliases = [
  ["mokly-logo", "mokly-logo-light"],
  ["mokly-icon", "mokly-icon-light"],
] as const;
const publishedFiles = [
  ...variants.flatMap(({ name }) => [`${name}.svg`, `${name}.png`]),
  ...aliases.flatMap(([name]) => [`${name}.svg`, `${name}.png`]),
];

test("the public SVG variants are self-contained token-aligned artwork", async () => {
  for (const variant of variants) {
    const svg = await readFile(assetPath(`${variant.name}.svg`), "utf8");
    assert.match(
      svg,
      new RegExp(
        `<svg[\\s\\S]*width="${variant.svgSize[0]}"[\\s\\S]*height="${variant.svgSize[1]}"`,
      ),
      variant.name,
    );
    assert.match(svg, /<title id="[^"]+">Mokly<\/title>/, variant.name);
    assert.ok(!svg.includes("<text"), `${variant.name} contains text`);
    assert.ok(!svg.includes("var("), `${variant.name} contains a CSS token`);
    for (const color of variant.colors) assert.ok(svg.includes(color), color);
  }
});

test("the public PNG variants are transparent and high resolution", async () => {
  for (const variant of variants) {
    const image = sharp(assetPath(`${variant.name}.png`));
    const metadata = await image.metadata();
    const { channels } = await image.stats();
    assert.equal(metadata.format, "png", variant.name);
    assert.equal(metadata.width, variant.pngSize[0], variant.name);
    assert.equal(metadata.height, variant.pngSize[1], variant.name);
    assert.equal(metadata.hasAlpha, true, variant.name);
    assert.equal(channels[3]?.min, 0, variant.name);
    assert.equal(channels[3]?.max, 255, variant.name);
  }
});

test("the unsuffixed assets remain light-mode aliases", async () => {
  for (const [alias, source] of aliases) {
    for (const extension of ["svg", "png"]) {
      assert.deepEqual(
        await readFile(assetPath(`${alias}.${extension}`)),
        await readFile(assetPath(`${source}.${extension}`)),
      );
    }
  }
});

test("the build publishes every stable brand asset path", async () => {
  for (const file of publishedFiles) {
    const source = await readFile(assetPath(file));
    const published = await readFile(sitePath("dist", "brand", file));
    assert.deepEqual(published, source, file);
  }
});
