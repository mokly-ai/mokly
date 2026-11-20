/**
 * Readers that the documentation tests share: the installed `@mokly/mokly`
 * version and guides, which the docs mockup depicts word for word, the code
 * panels of a generated page, and lookups of its elements.
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
