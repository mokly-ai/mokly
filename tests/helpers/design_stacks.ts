import assert from "node:assert/strict";

import { parse, type DefaultTreeAdapterMap } from "parse5";

import {
  attribute,
  byClass,
  designCatalogue,
  type Element,
} from "./design_catalogue.js";

export type Document = DefaultTreeAdapterMap["document"];
export type Viewport = "desktop" | "mobile";

/** Every generated view of one design, in each scheme it renders in. */
export async function renders(
  id: string,
): Promise<{ dark: boolean; document: Document; route: string }[]> {
  const { manifest, outputs } = await designCatalogue;
  const entry = manifest.entries.find((candidate) => candidate.id === id);
  assert.ok(entry?.kind === "screen", id);
  return [
    ...Object.values(entry.fragments).map((route) => [route, false] as const),
    ...Object.values(entry.darkFragments ?? {}).map(
      (route) => [route, true] as const,
    ),
  ].map(([route, dark]) => {
    const html = outputs.get(route);
    assert.ok(html, route);
    return { dark, document: parse(html), route };
  });
}

/** Both depicted previews of an artboard, each with its viewport. */
export function previews(document: Document): [Viewport, Element][] {
  return byClass(document, "ce-preview-view").map((view) => {
    const viewport = attribute(view, "data-preview-viewport");
    assert.ok(viewport === "desktop" || viewport === "mobile");
    return [viewport, view];
  });
}

export function children(node: Element): Element[] {
  return node.childNodes.filter(
    (child): child is Element => "tagName" in child,
  );
}

export function hasClass(node: Element, name: string): boolean {
  return (attribute(node, "class") ?? "").split(/\s+/u).includes(name);
}
