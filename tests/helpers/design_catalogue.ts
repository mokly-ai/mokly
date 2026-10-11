import assert from "node:assert/strict";

import { parse, type DefaultTreeAdapterMap } from "parse5";

import { viewRoute } from "../../packages/viewer/dist/data.js";
import type { ManifestScreen } from "../../packages/viewer/dist/registry/types.js";

import { exampleCompilation } from "./example_compilation.js";
import { textOutput } from "./generated_text.js";

type Node = DefaultTreeAdapterMap["node"];
export type Element = DefaultTreeAdapterMap["element"];

/**
 * The real consumer's compilation, loaded once per test process from the
 * prepared snapshot or compiled in memory when the snapshot is not fresh.
 */
export const designCatalogue = exampleCompilation();

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
  const entry = compilation.manifest.entries.find((entry) => entry.path === id);
  assert.ok(entry?.kind === "screen", `Missing screen ${id}`);
  const route = viewRoute(entry.path, viewport, "light");
  const html = textOutput(compilation.outputs, route);
  assert.ok(html, `Missing ${viewport} output for ${id}`);
  return { document: parse(html), entry, html, route };
}
