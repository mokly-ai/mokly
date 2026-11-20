/** Render the app icon set that electron-builder packages from its SVG source. */

import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const source = new URL("../build/icon.svg", import.meta.url);
const output = new URL("../build/icons/", import.meta.url);

/** The freedesktop hicolor sizes, plus the 1024 px master that macOS needs. */
export const iconSizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

/** Each icon file name, such as `256x256.png`, with its rendered bytes. */
export async function renderIcons() {
  const svg = await readFile(source);
  const icons = new Map();
  for (const size of iconSizes) {
    const png = await sharp(svg, { density: (72 * size) / 1024 })
      .resize(size, size, { fit: "fill" })
      .png({ compressionLevel: 9 })
      .toBuffer();
    icons.set(`${size}x${size}.png`, png);
  }
  return icons;
}

if (import.meta.main) {
  const arguments_ = process.argv.slice(2);
  assert.ok(
    arguments_.length === 0 ||
      (arguments_.length === 1 && arguments_[0] === "--check"),
    "usage: node scripts/icon.mjs [--check]",
  );
  const icons = await renderIcons();
  if (arguments_[0] === "--check") {
    assert.deepEqual((await readdir(output)).sort(), [...icons.keys()].sort());
    for (const [name, png] of icons)
      assert.ok(
        (await readFile(new URL(name, output))).equals(png),
        `build/icons/${name} is stale; run npm run icon:build --workspace @mokly-cloud/desktop`,
      );
    process.stdout.write("desktop:icon set matches its source.\n");
  } else {
    await mkdir(output, { recursive: true });
    for (const [name, png] of icons)
      await writeFile(fileURLToPath(new URL(name, output)), png);
    process.stdout.write(`desktop:icon wrote ${icons.size} sizes.\n`);
  }
}
