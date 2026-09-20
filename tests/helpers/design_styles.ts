import fs from "node:fs/promises";
import path from "node:path";

import { repositoryRoot } from "./fixture.js";

/** A CSS rule in one of the design stylesheets. */
export interface StyleRule {
  file: string;
  selector: string;
  body: string;
}

const GENERATED = path.join(repositoryRoot, "examples/basic/generated");

/**
 * The design catalogue's own chrome. `styles.css` and `example-components.css`
 * style the depicted product inside a device screen, so they carry their own
 * colours and are deliberately outside the interface palette.
 */
function isDesignStylesheet(relative: string): boolean {
  return (
    relative.startsWith("design-library/") ||
    (!relative.includes("/") && relative.startsWith("design"))
  );
}

/** Every rule in every design stylesheet, including the shared library. */
export async function designStyleRules(): Promise<StyleRule[]> {
  const entries = await fs.readdir(GENERATED, {
    recursive: true,
    withFileTypes: true,
  });
  const rules: StyleRule[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".css")) continue;
    const absolute = path.join(entry.parentPath, entry.name);
    const relative = path.relative(GENERATED, absolute).replaceAll("\\", "/");
    if (!isDesignStylesheet(relative)) continue;
    const source = await fs.readFile(absolute, "utf8");
    for (const [, selector, body] of source.matchAll(/([^{}]+)\{([^}]*)\}/g))
      if (selector && body)
        rules.push({
          file: relative,
          selector: selector.replace(/\s+/gu, " ").trim(),
          body,
        });
  }
  return rules;
}

/** Reads one declaration's value, ignoring shorthand extras like `1px solid`. */
export function declaration(
  body: string,
  property: string,
): string | undefined {
  return new RegExp(`(?:^|;|\\{)\\s*${property}\\s*:\\s*([^;]+)`, "u")
    .exec(body)?.[1]
    ?.trim();
}

/** A colour reference, either a palette token or a literal the CSS pins. */
export interface ColorReference {
  token?: string;
  literal?: string;
}

/** Pulls the colour out of a declaration, whether tokenised or hardcoded. */
export function colorReference(
  value: string | undefined,
): ColorReference | undefined {
  if (!value) return undefined;
  const token = /var\((--[a-z0-9-]+)\)/u.exec(value)?.[1];
  if (token) return { token };
  const literal = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/u.exec(value)?.[0];
  return literal ? { literal } : undefined;
}

/** The boundary a rule draws, from `border-color`, `border` or `outline`. */
export function boundaryOf(body: string): ColorReference | undefined {
  return (
    colorReference(declaration(body, "border-color")) ??
    colorReference(declaration(body, "border")) ??
    colorReference(declaration(body, "outline"))
  );
}

/** The fill a rule paints behind that boundary. */
export function fillOf(body: string): ColorReference | undefined {
  return (
    colorReference(declaration(body, "background-color")) ??
    colorReference(declaration(body, "background"))
  );
}
