import assert from "node:assert/strict";

import { parse, type DefaultTreeAdapterMap } from "parse5";

import { generatedViews } from "../../packages/viewer/dist/components/views.js";

import {
  attribute,
  byClass,
  designCatalogue,
  textContent,
  type Element,
} from "./design_catalogue.js";

export type Document = DefaultTreeAdapterMap["document"];
export type Viewport = "desktop" | "mobile";

/** Every generated view of one design, in each scheme it renders in. */
export async function renders(
  id: string,
): Promise<{ dark: boolean; document: Document; route: string }[]> {
  const { manifest, outputs } = await designCatalogue;
  const entry = manifest.entries.find((candidate) => candidate.path === id);
  assert.ok(entry?.kind === "screen", id);
  return generatedViews(entry).map((view) => {
    const route = view.path;
    const html = outputs.get(route);
    assert.ok(html, route);
    return {
      dark: view.colorScheme === "dark",
      document: parse(html),
      route,
    };
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

/** The one component comparison a preview depicts, with its caption. */
export function comparison(
  preview: Element,
  where: string,
): { caption: string; compare: Element } {
  const [depicted, ...others] = byClass(preview, "ce-component-comparison");
  assert.ok(depicted, where);
  assert.equal(others.length, 0, where);
  const compares = byClass(depicted, "mbk-compare");
  assert.equal(compares.length, 1, where);
  const captions = byClass(depicted, "ce-caption");
  assert.equal(captions.length, 1, where);
  return { caption: textContent(captions[0]!), compare: compares[0]! };
}

/** The panel an artboard's inspector opens with. */
export function openPanel(document: Document): string | undefined {
  const [inspector, ...others] = byClass(document, "ce-inspector");
  assert.ok(inspector);
  assert.equal(others.length, 0);
  const open = children(inspector).filter(
    (node) =>
      node.tagName === "details" && attribute(node, "open") !== undefined,
  );
  assert.ok(open.length <= 1);
  return open[0] && attribute(open[0], "data-panel");
}
