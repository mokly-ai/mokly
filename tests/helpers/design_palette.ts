import fs from "node:fs/promises";
import path from "node:path";

import { repositoryRoot } from "./fixture.js";

/** The two interface palettes the design mockups select between. */
export type Appearance = "light" | "dark";

const LIGHT_BLOCK = /\[data-mbk-appearance="light"\]\s*\{([^}]*)\}/;
const DARK_BLOCK = /\[data-mbk-appearance="dark"\]\s*\{([^}]*)\}/;

function readTokens(block: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const [, name, value] of block.matchAll(
    /(--[a-z0-9-]+)\s*:\s*([^;]+);/g,
  ))
    tokens.set(name!, value!.replace(/\s+/g, " ").trim());
  return tokens;
}

/** Both palettes exactly as the shared design stylesheet declares them. */
async function designPalette(): Promise<
  Record<Appearance, Map<string, string>>
> {
  const source = await fs.readFile(
    path.join(repositoryRoot, "examples/basic/design.css"),
    "utf8",
  );
  const light = LIGHT_BLOCK.exec(source);
  const dark = DARK_BLOCK.exec(source);
  if (!light?.[1] || !dark?.[1])
    throw new Error("design.css is missing a palette block");
  return { light: readTokens(light[1]), dark: readTokens(dark[1]) };
}

/** The CSS `rgb()` form of an opaque `#rgb` or `#rrggbb` colour. */
function cssColor(color: string): string {
  const hex = color.trim().replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((part) => part + part)
          .join("")
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full))
    throw new Error(`not an opaque colour: ${color}`);
  const channels = [0, 2, 4].map((start) =>
    Number.parseInt(full.slice(start, start + 2), 16),
  );
  return `rgb(${channels.join(", ")})`;
}

/** One palette token as the CSS `rgb()` value a computed style reports. */
export async function paletteColor(
  appearance: Appearance,
  token: string,
): Promise<string> {
  const value = (await designPalette())[appearance].get(token);
  if (!value) throw new Error(`design.css has no ${token} for ${appearance}`);
  return cssColor(value);
}
