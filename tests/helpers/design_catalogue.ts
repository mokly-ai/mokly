import assert from "node:assert/strict";

import { parse, type DefaultTreeAdapterMap } from "parse5";

import { compileCatalogue } from "../../dist/build/compile.js";
import { loadConfig } from "../../dist/config/load.js";
import type { ManifestScreen } from "../../packages/viewer/dist/registry/types.js";

import { repositoryRoot } from "./fixture.js";

type Node = DefaultTreeAdapterMap["node"];
export type Element = DefaultTreeAdapterMap["element"];

/** Compile the real consumer once per test process without writing output. */
export const designCatalogue = loadConfig(
  repositoryRoot,
  "examples/basic/mokly.config.ts",
).then(compileCatalogue);

export function elements(
  node: Node,
  predicate: (node: Element) => boolean,
): Element[] {
  const matches = "tagName" in node && predicate(node) ? [node] : [];
  return "childNodes" in node
    ? [
        ...matches,
        ...node.childNodes.flatMap((child) => elements(child, predicate)),
      ]
    : matches;
}

export function attribute(node: Element, name: string): string | undefined {
  return node.attrs.find((attribute) => attribute.name === name)?.value;
}

export function textContent(node: Node): string {
  if ("value" in node) return node.value;
  return "childNodes" in node ? node.childNodes.map(textContent).join("") : "";
}

export function byClass(node: Node, className: string): Element[] {
  return elements(node, (element) =>
    (attribute(element, "class") ?? "").split(/\s+/).includes(className),
  );
}

export async function designDocument(
  id: string,
  viewport: "mobile" | "desktop",
): Promise<{
  document: DefaultTreeAdapterMap["document"];
  entry: ManifestScreen;
  html: string;
  route: string;
}> {
  const compilation = await designCatalogue;
  const entry = compilation.manifest.entries.find((entry) => entry.id === id);
  assert.ok(entry?.kind === "screen", `Missing screen ${id}`);
  const route = entry.fragments[viewport];
  const html = compilation.outputs.get(route);
  assert.ok(html, `Missing ${viewport} output for ${id}`);
  return { document: parse(html), entry, html, route };
}
