import fs from "node:fs/promises";
import path from "node:path";

import { repositoryRoot } from "./fixture.js";

/** A CSS rule in one of the design stylesheets. */
export interface StyleRule {
  file: string;
  selector: string;
  body: string;
}

const CATALOGUE = path.join(repositoryRoot, "examples/basic");

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

/** The sources of the shared UI package, relative to the repository. */
const PACKAGE_SOURCE = "packages/ui/src/";

/**
 * Each `@mokly/ui` stylesheet that a design stylesheet imports from the
 * package source, as its path relative to the repository.
 */
function packageImports(relative: string, source: string): string[] {
  const directory = path.posix.join(
    "examples/basic",
    path.posix.dirname(relative),
  );
  return [...source.matchAll(/@import\s+["']([^"']+)["']/gu)].flatMap(
    ([, specifier]) => {
      const target = path.posix.join(directory, specifier!);
      return target.startsWith(PACKAGE_SOURCE) ? [target] : [];
    },
  );
}

/**
 * The style rules of a stylesheet, including those inside `@layer`, `@media`
 * and other block at-rules, without comments. Statement at-rules such as
 * `@import` hold no rule.
 */
export function styleRules(file: string, source: string): StyleRule[] {
  const text = source.replace(/\/\*[^]*?\*\//gu, "");
  const rules: StyleRule[] = [];
  let start = 0;
  for (let at = 0; at < text.length; at++) {
    if (text[at] === ";" && text.slice(start, at).trim().startsWith("@")) {
      start = at + 1;
    } else if (text[at] === "{") {
      const prelude = text.slice(start, at).trim();
      if (prelude.startsWith("@")) {
        start = at + 1;
        continue;
      }
      const end = text.indexOf("}", at);
      const body = text.slice(at + 1, end === -1 ? text.length : end);
      rules.push({
        file,
        selector: prelude.replace(/\s+/gu, " "),
        body,
      });
      at = end === -1 ? text.length : end;
      start = at + 1;
    } else if (text[at] === "}") {
      start = at + 1;
    }
  }
  return rules.filter((rule) => rule.selector && rule.body.trim());
}

/**
 * Every rule in every design stylesheet, including the shared library, and
 * in each `@mokly/ui` stylesheet that one of them imports. A package rule is
 * named by its repository path, a design rule by its path in the example.
 */
export async function designStyleRules(): Promise<StyleRule[]> {
  const entries = await fs.readdir(CATALOGUE, {
    recursive: true,
    withFileTypes: true,
  });
  const rules: StyleRule[] = [];
  const imported = new Set<string>();
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".css")) continue;
    const absolute = path.join(entry.parentPath, entry.name);
    const relative = path.relative(CATALOGUE, absolute).replaceAll("\\", "/");
    if (!isDesignStylesheet(relative)) continue;
    const source = await fs.readFile(absolute, "utf8");
    rules.push(...styleRules(relative, source));
    for (const file of packageImports(relative, source)) imported.add(file);
  }
  for (const file of [...imported].sort())
    rules.push(
      ...styleRules(
        file,
        await fs.readFile(path.join(repositoryRoot, file), "utf8"),
      ),
    );
  return rules;
}

/** Reads one declaration's value, ignoring shorthand extras like `1px solid`. */
function declaration(body: string, property: string): string | undefined {
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
function colorReference(value: string | undefined): ColorReference | undefined {
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
