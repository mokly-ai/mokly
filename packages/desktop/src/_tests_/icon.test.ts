import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";

import { parse } from "yaml";

import { iconSizes, renderIcons } from "../../scripts/icon.mjs";

const desktop = new URL("../../", import.meta.url);
const icons = new URL("build/icons/", desktop);

test("the committed icon set is the rendering of its SVG source", async () => {
  const rendered = await renderIcons();
  assert.deepEqual((await readdir(icons)).sort(), [...rendered.keys()].sort());
  for (const [name, png] of rendered)
    assert.ok(
      (await readFile(new URL(name, icons))).equals(png),
      `${name}: run npm run icon:build --workspace @mokly-cloud/desktop`,
    );
});

test("each icon is a square PNG with transparency at its named size", async () => {
  for (const size of iconSizes) {
    const png = await readFile(new URL(`${size}x${size}.png`, icons));
    assert.deepEqual(
      [...png.subarray(0, 8)],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    );
    assert.equal(png.toString("ascii", 12, 16), "IHDR");
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
    // Colour type 6 is RGB with alpha, so the plate's corners stay clear.
    assert.equal(png[25], 6);
  }
});

test("macOS packages the 1024 px master and Linux the whole set", async () => {
  const config = parse(
    await readFile(new URL("electron-builder.yml", desktop), "utf8"),
  );
  assert.equal(config.mac.icon, "build/icons/1024x1024.png");
  assert.equal(config.linux.icon, "build/icons");
});
