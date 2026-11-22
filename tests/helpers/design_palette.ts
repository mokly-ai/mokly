import fs from "node:fs/promises";
import path from "node:path";

import { CANVAS_SAMPLES } from "../../examples/basic/specs/design/library/metadata.js";
import { libraryStyleFiles } from "../../examples/basic/specs/design/library/style_files.js";
import { canvasProperties } from "../../examples/basic/specs/design/parts/canvas_palette.js";
import { palettes } from "../../packages/ui/dist/palette/palette.js";

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

/**
 * The custom properties that a Canvas root declares in one appearance, as
 * its palette scope maps them from the Canvas palette of the built
 * `@mokly/ui` palette module: the `--cv-*` roles and the shell tokens.
 */
export function canvasScopeTokens(appearance: Appearance): Map<string, string> {
  return new Map(
    Object.entries(
      canvasProperties(palettes.canvas[appearance], palettes.canvas.fonts),
    ),
  );
}

/**
 * Both palettes that a Canvas root draws in: the design palette, whose roles
 * the root keeps where its scope declares nothing, overlaid with the tokens
 * that its scope declares.
 */
export async function canvasPalette(): Promise<
  Record<Appearance, Map<string, string>>
> {
  const design = await designPalette();
  const overlay = (appearance: Appearance) =>
    new Map([...design[appearance], ...canvasScopeTokens(appearance)]);
  return { light: overlay("light"), dark: overlay("dark") };
}

/**
 * The Canvas viewer's stylesheets, whose rules draw inside a Canvas root
 * only: the shared Canvas sheets and the sheet of each Canvas part.
 */
export function isCanvasStylesheet(file: string): boolean {
  return (
    /^design-canvas(-[a-z]+)?\.css$/u.test(file) ||
    Object.entries(libraryStyleFiles).some(
      ([slug, sheet]) => sheet === file && CANVAS_SAMPLES.has(slug),
    )
  );
}

/** A role that the Canvas palette lacks: two scope roles mixed in sRGB. */
const SRGB_MIX =
  /^color-mix\(\s*in srgb,\s*var\((--[\w-]+)\)\s+(\d+(?:\.\d+)?)%,\s*var\((--[\w-]+)\)\s*\)$/u;

/** Two opaque `#rrggbb` colours mixed in sRGB, as `color-mix()` mixes them. */
function srgbMix(first: string, share: number, second: string): string {
  const channels = (color: string) =>
    [1, 3, 5].map((at) => Number.parseInt(color.slice(at, at + 2), 16));
  const other = channels(second);
  return `#${channels(first)
    .map((value, index) =>
      Math.round(value * share + other[index]! * (1 - share))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/**
 * The colour of one role on a Canvas root in one appearance: a role that its
 * palette scope declares, or an opaque role that the root's rule in a shared
 * Canvas sheet mixes from two scope roles, such as the stronger hairline.
 */
export async function canvasRoleColor(
  role: string,
  appearance: Appearance,
): Promise<string | undefined> {
  const tokens = canvasScopeTokens(appearance);
  const declared = tokens.get(role);
  if (declared) return declared;
  const roots = new Set([".cv", `.cv[data-mbk-appearance="${appearance}"]`]);
  const value = (await designStyleRules())
    .filter((rule) => isCanvasStylesheet(rule.file) && roots.has(rule.selector))
    .flatMap((rule) => [...rule.body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/gu)])
    .findLast(([, name]) => name === role)?.[2];
  const mix = SRGB_MIX.exec(value?.trim() ?? "");
  if (!mix) return undefined;
  const [first, second] = [tokens.get(mix[1]!), tokens.get(mix[3]!)];
  return first && second
    ? srgbMix(first, Number(mix[2]) / 100, second)
    : undefined;
}

/** A palette that a rule draws in, by appearance, named for a failure. */
export interface AuditPalette {
  name: "design" | "Canvas";
  tokens: Record<Appearance, Map<string, string>>;
}

/**
 * The palettes that each design stylesheet's rules draw in: a Canvas
 * sheet's in a Canvas root only, a `@mokly/ui` sheet's in the design
 * catalogue's palette and in a Canvas root, and every other design sheet's
 * in the design catalogue's palette.
 */
export async function auditPalettes(): Promise<
  (file: string) => readonly AuditPalette[]
> {
  const design: AuditPalette = {
    name: "design",
    tokens: await designPalette(),
  };
  const canvas: AuditPalette = {
    name: "Canvas",
    tokens: await canvasPalette(),
  };
  return (file) =>
    isCanvasStylesheet(file)
      ? [canvas]
      : file.startsWith("packages/ui/src/")
        ? [design, canvas]
        : [design];
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

/** One Canvas role on a Canvas root as the `rgb()` value a style reports. */
export async function canvasColor(appearance: Appearance, role: string) {
  const value = await canvasRoleColor(role, appearance);
  if (!value) throw new Error(`Canvas has no opaque ${role} in ${appearance}`);
  return cssColor(value);
}
