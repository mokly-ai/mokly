/**
 * Readers that the documentation tests share: the installed `@mokly/mokly`
 * version and guides, which the docs mockup depicts word for word, the code
 * panels of a generated page, lookups of its elements, and the site style
 * rules with the width query that holds each.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { readFrontmatter } from "../../../../apps/site/src/docs/frontmatter";

import {
  byClass,
  elements,
  label,
  repositoryRoot,
  siteStyles,
  textContent,
  type Element,
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
      open = { language: line.slice(3).trim(), lines: [] };
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

/** Every rule of the site styles, each with the width query that holds it. */
export function siteRules(): SiteRule[] {
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
  read(siteStyles().replace(/\/\*[\s\S]*?\*\//g, ""), null);
  return found;
}
