/**
 * Readers that the documentation tests share: the installed `@mokly/mokly`
 * version and guides, which the docs mockup depicts word for word, the code
 * panels of a generated page, lookups of its elements, the site style
 * rules with the width query that holds each, and the colours of those
 * rules in the Canvas palette.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { palettes } from "@mokly/ui/palette";

import { readFrontmatter } from "../../../../apps/site/src/docs/frontmatter";

import {
  byClass,
  elements,
  label,
  repositoryRoot,
  siteStyles,
  textContent,
  type Element,
  type SiteScreenPath,
} from "./design-site-test-helpers";

/** The installed package, which the site reads its guides from. */
const PACKAGE = "node_modules/@mokly/mokly";

/** The installed `@mokly/mokly` version. */
export function installedVersion(): string {
  const manifest = JSON.parse(
    readFileSync(resolve(repositoryRoot, PACKAGE, "package.json"), "utf8"),
  ) as { version: string };
  return manifest.version;
}

/** One fenced code block: its language and its code. */
export interface CodeBlock {
  code: string;
  language: string;
}

/**
 * One installed guide, such as `start/install.md`: its description, its
 * `##` headings and its fenced code blocks, in order.
 */
export function installedGuide(path: string): {
  description: string;
  fences: CodeBlock[];
  headings: string[];
} {
  const source = readFileSync(
    resolve(repositoryRoot, PACKAGE, "docs/guides", path),
    "utf8",
  );
  const headings: string[] = [];
  const fences: CodeBlock[] = [];
  let open: { language: string; lines: string[] } | undefined;
  for (const line of source.split("\n")) {
    if (open !== undefined && line.startsWith("```")) {
      fences.push({ code: open.lines.join("\n"), language: open.language });
      open = undefined;
    } else if (open !== undefined) open.lines.push(line);
    else if (line.startsWith("```"))
      open = { language: line.slice(3).trim().split(/\s+/u)[0]!, lines: [] };
    else if (line.startsWith("## ")) headings.push(line.slice(3).trim());
  }
  const { data } = readFrontmatter(source, path);
  return { description: data.description, fences, headings };
}

/** Every code panel under `root`: the language it names and its code. */
export function codePanels(root: Element): CodeBlock[] {
  return byClass(root, "site-code").map((panel) => ({
    code: byClass(panel, "site-code-line").map(textContent).join("\n"),
    language: label(byClass(panel, "site-code-language")[0]!),
  }));
}

/** A parsed document or one of its elements. */
export type Root = Parameters<typeof byClass>[0];

/** The one element of `root` with `className`. */
export function one(root: Root, className: string): Element {
  const found = byClass(root, className);
  assert.equal(found.length, 1, className);
  return found[0]!;
}

/** Every element of `root` with the tag name. */
export function tags(root: Root, tagName: string): Element[] {
  return elements(root, (node) => node.tagName === tagName);
}

/** One rule of the site styles and the width query around it, if any. */
export interface SiteRule {
  at: string | null;
  declarations: string;
  selectors: string[];
}

/**
 * Every rule of the site styles, or of the styles of one screen, each with
 * the width query that holds it.
 */
export function siteRules(screen?: SiteScreenPath): SiteRule[] {
  const found: SiteRule[] = [];
  const read = (source: string, at: string | null) => {
    let index = 0;
    while (index < source.length) {
      const brace = source.indexOf("{", index);
      if (brace === -1) break;
      const prelude = source.slice(index, brace).trim().replace(/\s+/g, " ");
      let depth = 0;
      let end = source.length - 1;
      for (let scan = brace; scan < source.length; scan += 1) {
        if (source[scan] === "{") depth += 1;
        else if (source[scan] === "}" && --depth === 0) {
          end = scan;
          break;
        }
      }
      const inner = source.slice(brace + 1, end);
      if (prelude.startsWith("@media")) read(inner, prelude);
      else if (!prelude.startsWith("@"))
        found.push({
          at,
          declarations: inner.trim().replace(/\s+/g, " "),
          selectors: prelude.split(",").map((part) => part.trim()),
        });
      index = end + 1;
    }
  };
  read(siteStyles(screen).replace(/\/\*[\s\S]*?\*\//g, ""), null);
  return found;
}

/** The value that one rule declares for a property, if it declares one. */
export function declared(rule: SiteRule, property: string): string | undefined {
  return rule.declarations
    .split(";")
    .map((declaration) => declaration.trim())
    .find((declaration) => declaration.startsWith(`${property}:`))
    ?.slice(property.length + 1)
    .trim();
}

/** A colour as its sRGB channels, each from 0 to 255. */
export type Rgb = readonly [number, number, number];

/** The Canvas palette value of one `--mk-color-*` role, such as `text`. */
function role(name: string, scheme: "light" | "dark"): Rgb {
  const palette = palettes.canvas[scheme];
  const person = /^people-(pink|blue|orange|violet)-(fill|ink)$/.exec(name);
  const value = person
    ? palette.people[person[1] as "pink"][person[2] as "fill"]
    : (palette as unknown as Record<string, unknown>)[
        name.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase())
      ];
  const hex = /^#([\da-f]{6})$/i.exec(String(value));
  assert.ok(hex, `--mk-color-${name} in ${scheme}: ${String(value)}`);
  return [0, 2, 4].map((at) =>
    Number.parseInt(hex[1]!.slice(at, at + 2), 16),
  ) as unknown as Rgb;
}

/**
 * One colour value of the site styles in the Canvas palette of a scheme: a
 * `var(--mk-color-*)` role, `currentColor` (the inherited `current`), or a
 * `color-mix(in srgb, A p%, B)` of two of them, mixed channel by channel.
 */
export function cssColour(
  value: string,
  scheme: "light" | "dark",
  current?: Rgb,
): Rgb {
  const text = value.trim();
  const mix = /^color-mix\(\s*in srgb,\s*(.+?)\s+([\d.]+)%,\s*(.+)\)$/.exec(
    text,
  );
  if (mix) {
    const share = Number(mix[2]) / 100;
    const first = cssColour(mix[1]!, scheme, current);
    const second = cssColour(mix[3]!, scheme, current);
    return first.map(
      (channel, at) => channel * share + second[at]! * (1 - share),
    ) as unknown as Rgb;
  }
  if (/^currentColor$/i.test(text)) {
    assert.ok(current, "currentColor needs the inherited colour");
    return current;
  }
  const variable = /^var\(--mk-color-([\w-]+)\)$/.exec(text);
  assert.ok(variable, `unsupported colour value: ${text}`);
  return role(variable[1]!, scheme);
}

/** A colour drawn at `opacity` over `fill`, as the browser composites it. */
export function composite(colour: Rgb, fill: Rgb, opacity: number): Rgb {
  return colour.map(
    (channel, at) => channel * opacity + fill[at]! * (1 - opacity),
  ) as unknown as Rgb;
}

/** The WCAG contrast ratio of two opaque colours. */
export function contrast(first: Rgb, second: Rgb): number {
  const luminance = (colour: Rgb) => {
    const [red, green, blue] = colour.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
  };
  const [lighter, darker] = [luminance(first), luminance(second)].sort(
    (left, right) => right - left,
  );
  return (lighter! + 0.05) / (darker! + 0.05);
}
