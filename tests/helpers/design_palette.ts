import fs from "node:fs/promises";
import path from "node:path";

import { designStyleRules, type ColorReference } from "./design_styles.js";
import { repositoryRoot } from "./fixture.js";

/** The two interface palettes the design mockups select between. */
export type Appearance = "light" | "dark";

const LIGHT_BLOCK = /\[data-mbk-appearance="light"\]\s*\{([^}]*)\}/;
const DARK_BLOCK = /\[data-mbk-appearance="dark"\]\s*\{([^}]*)\}/;

/**
 * The roles of one palette block, including private names such as
 * `--_mokly-private-on-accent-deep`. A role that names another role of the
 * block, such as `var(--mbk-sage)`, takes that role's value.
 */
function readTokens(block: string): Map<string, string> {
  const declared = new Map<string, string>();
  for (const [, name, value] of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g))
    declared.set(name!, value!.replace(/\s+/g, " ").trim());
  const tokens = new Map<string, string>();
  for (const [name, value] of declared) {
    const alias = /^var\((--[\w-]+)\)$/u.exec(value)?.[1];
    tokens.set(name, (alias && declared.get(alias)) || value);
  }
  return tokens;
}

/** Both palettes exactly as the shared design stylesheet declares them. */
export async function designPalette(): Promise<
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

const PREVIEW_BLOCK = /:root\s*\{([^}]*)\}/;

/**
 * The preview tokens of the stage stylesheet: the screen, device, and traffic
 * light colours, which stay independent of the interface appearance.
 */
export async function designPreviewTokens(): Promise<Map<string, string>> {
  const source = await fs.readFile(
    path.join(repositoryRoot, "examples/basic/design-stage.css"),
    "utf8",
  );
  const block = PREVIEW_BLOCK.exec(source)?.[1];
  if (!block) throw new Error("design-stage.css is missing its preview tokens");
  return readTokens(block);
}

/** The shipped theme of `@mokly/ui`, by its repository path. */
export const SHIPPED_THEME = "packages/ui/src/theme/theme.css";

/**
 * The tokens that the shipped theme declares on the viewer root class, which
 * every artboard's and sample's root carries, when a design stylesheet
 * imports the theme: its Light half, which the Dark half redeclares.
 */
export async function designThemeTokens(): Promise<Map<string, string>> {
  const tokens = new Map<string, string>();
  for (const rule of await designStyleRules())
    if (rule.file === SHIPPED_THEME && rule.selector === ".mbk, .mbk-document")
      for (const [, name, value] of rule.body.matchAll(
        /(--[\w-]+)\s*:\s*([^;]+);/gu,
      ))
        tokens.set(name!, value!.replace(/\s+/gu, " ").trim());
  return tokens;
}

function channel(value: number): number {
  const ratio = value / 255;
  return ratio <= 0.04045 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of an opaque `#rgb` or `#rrggbb` color. */
function luminance(color: string): number {
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

/** Resolves a reference to the colour it paints in one appearance. */
function resolve(
  reference: ColorReference,
  tokens: Map<string, string>,
): string | undefined {
  return reference.token ? tokens.get(reference.token) : reference.literal;
}

/** Whether a palette value is an opaque `#rgb` or `#rrggbb` colour. */
function isOpaque(color: string): boolean {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/iu.test(color.trim());
}

/**
 * A boundary sits between its own fill and the surface around it, so it only
 * has to reach 3:1 against one of them to read as an edge. A translucent fill,
 * such as the accent tint of a pressed icon button, shows the surface through
 * it, so the surface decides.
 */
export function boundaryContrast(
  boundary: ColorReference,
  fill: ColorReference | undefined,
  tokens: Map<string, string>,
): number | undefined {
  const edge = resolve(boundary, tokens);
  if (!edge) return undefined;
  const behind = fill ? resolve(fill, tokens) : undefined;
  return Math.max(
    behind && isOpaque(behind) ? contrast(edge, behind) : 0,
    contrast(edge, tokens.get("--chrome-surface")!),
  );
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
