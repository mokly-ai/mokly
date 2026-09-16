/**
 * Rasterize one social card per published route before Astro runs, so the
 * per-page metadata can advertise an image the build has produced. Cards are
 * drawn as SVG by `src/og.ts` and turned into PNG here with sharp, which
 * Astro already depends on, so the site adds no image toolchain of its own.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { SOCIAL_IMAGE_DIRECTORY } from "../src/metadata.ts";
import { CARD_HEIGHT, CARD_WIDTH, cards } from "../src/og.ts";

const directory = SOCIAL_IMAGE_DIRECTORY;

await rm(directory, { force: true, recursive: true });
await mkdir(directory, { recursive: true });

const documents = cards();
for (const [file, document] of documents) {
  const png = await sharp(Buffer.from(document), { density: 96 })
    .resize(CARD_WIDTH, CARD_HEIGHT, { fit: "fill" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(directory, file), png);
}

process.stdout.write(`site:og drew ${documents.size} social cards.\n`);
