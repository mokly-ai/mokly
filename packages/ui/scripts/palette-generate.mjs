/**
 * Write the stylesheets that the Canvas palette generates, or, with `--check`,
 * compare them with the committed files and write nothing. Run it through
 * `npm run palette:generate` and `npm run palette:check`. Each stylesheet is
 * formatted with Prettier and the repository's options for its path, so the
 * committed bytes pass the format check.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format, resolveConfig } from "prettier";

import { palettes } from "../src/palette/palette.js";

import {
  GENERATE_COMMAND,
  PALETTE_SOURCE,
  paletteStylesheets,
} from "./palette-styles.mjs";

/** The advice of every line that names a stale stylesheet. */
const ADVICE = `run ${GENERATE_COMMAND} and commit the result`;

/**
 * Write each stylesheet that differs from its committed file, or, in a check,
 * report each one that differs or is missing and write nothing. Resolves to
 * the exit status: 1 when a check finds a stale stylesheet, else 0.
 */
export async function generatePaletteStylesheets({
  check,
  stylesheets,
  read,
  write,
  report,
}) {
  let stale = false;
  for (const { path: file, css } of stylesheets) {
    const committed = await read(file);
    if (committed === css) continue;
    if (!check) {
      await write(file, css);
      report(`[palette] wrote ${file}`);
      continue;
    }
    stale = true;
    report(
      committed === undefined
        ? `[palette] ${file} is missing; ${ADVICE}`
        : `[palette] ${file} differs from ${PALETTE_SOURCE}; ${ADVICE}`,
    );
  }
  return stale ? 1 : 0;
}

/** The repository root, which every stylesheet path is relative to. */
const ROOT = path.resolve(import.meta.dirname, "../../..");

/** The committed text of a stylesheet, or undefined when it is missing. */
async function committedText(file) {
  try {
    return await fs.readFile(path.join(ROOT, file), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

/** A stylesheet as Prettier formats it with the options for its path. */
async function formatted({ path: file, css }) {
  const filepath = path.join(ROOT, file);
  const options = await resolveConfig(filepath);
  return { path: file, css: await format(css, { ...options, filepath }) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await generatePaletteStylesheets({
    check: process.argv.includes("--check"),
    stylesheets: await Promise.all(
      paletteStylesheets(palettes.canvas).map(formatted),
    ),
    read: committedText,
    write: (file, css) => fs.writeFile(path.join(ROOT, file), css),
    report: (line) => console.error(line),
  });
}
