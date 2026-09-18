import fs from "node:fs/promises";
import path from "node:path";

import { repositoryRoot } from "./fixture.js";

/** The two interface palettes the design mockups select between. */
export type Appearance = "light" | "dark";

const LIGHT_BLOCK = /:root\s*\{([^}]*)\}/;
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
export async function designPalette(): Promise<
  Record<Appearance, Map<string, string>>
> {
  const source = await fs.readFile(
    path.join(repositoryRoot, "examples/basic/generated/design.css"),
    "utf8",
  );
  const light = LIGHT_BLOCK.exec(source);
  const dark = DARK_BLOCK.exec(source);
  if (!light?.[1] || !dark?.[1])
    throw new Error("design.css is missing a palette block");
  return { light: readTokens(light[1]), dark: readTokens(dark[1]) };
}

function channel(value: number): number {
  const ratio = value / 255;
  return ratio <= 0.04045 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of an opaque `#rgb` or `#rrggbb` color. */
export function luminance(color: string): number {
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
  return (
    0.2126 * channel(Number.parseInt(full.slice(0, 2), 16)) +
    0.7152 * channel(Number.parseInt(full.slice(2, 4), 16)) +
    0.0722 * channel(Number.parseInt(full.slice(4, 6), 16))
  );
}

/** WCAG contrast ratio, truncated to the two decimals the contract records. */
export function contrast(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  const ratio =
    (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  return Math.floor(ratio * 100) / 100;
}
