import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { parse, type DefaultTreeAdapterMap } from "parse5";

import { NOT_FOUND_ROUTE } from "../../src/metadata.js";
import { sitePath } from "../../src/workspace.js";

import { attribute, byTag, elements, markupLabel } from "./html.js";

type Node = DefaultTreeAdapterMap["node"];

export function builtFile(...path: string[]): string {
  const file = sitePath("dist", ...path);
  assert.ok(existsSync(file), `missing built output: ${file}`);
  return readFileSync(file, "utf8");
}

export function builtPage(route: string): DefaultTreeAdapterMap["document"] {
  return parse(
    route === NOT_FOUND_ROUTE
      ? builtFile(`${NOT_FOUND_ROUTE}.html`)
      : builtFile(route, "index.html"),
  );
}

export function anchors(node: Node): ReturnType<typeof byTag> {
  return byTag(node, "a").filter(
    (link) => attribute(link, "href") !== undefined,
  );
}

export function labelled(
  node: Node,
  tag: string,
  label: string,
): ReturnType<typeof byTag> {
  return byTag(node, tag).filter(
    (element) => attribute(element, "aria-label") === label,
  );
}

export function byId(node: Node, id: string): DefaultTreeAdapterMap["element"] {
  const matches = elements(node, (element) => attribute(element, "id") === id);
  const [element] = matches;
  assert.ok(element && matches.length === 1, `one #${id}`);
  return element;
}

export function namedLinks(
  node: Node,
): (readonly [label: string, href: string | undefined])[] {
  return anchors(node).map(
    (link) => [markupLabel(link), attribute(link, "href")] as const,
  );
}
