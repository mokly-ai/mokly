import assert from "node:assert/strict";
import test from "node:test";

import { parse, type DefaultTreeAdapterMap } from "parse5";

import { DOCS_PAGES } from "../src/docs/pages.js";
import { NOT_FOUND_ROUTE } from "../src/metadata.js";
import { SITE_PATHS } from "../src/navigation.js";

import {
  attribute,
  byTag,
  elements,
  hiddenInMarkup,
  markupLabel,
  normalizeText,
  referencedLabel,
  textContent,
} from "./helpers/html.js";
import { ROUTES } from "./helpers/published-routes.js";
import { builtPage } from "./helpers/site-output.js";

type Element = DefaultTreeAdapterMap["element"];

const DOCS_ROUTES = new Set<string>([
  SITE_PATHS.docs,
  ...DOCS_PAGES.map(({ route }) => route),
]);

function isControl(element: Element): boolean {
  const role = attribute(element, "role");
  return (
    role === "button" ||
    role === "link" ||
    element.tagName === "button" ||
    (["a", "area"].includes(element.tagName) &&
      attribute(element, "href") !== undefined) ||
    (element.tagName === "input" &&
      ["button", "image", "reset", "submit"].includes(inputType(element)))
  );
}

function inputType(element: Element): string {
  return attribute(element, "type")?.toLowerCase() ?? "";
}

function hiddenControl(element: Element): boolean {
  if (hiddenInMarkup(element)) return true;
  const { parentNode } = element;
  return parentNode !== null && "tagName" in parentNode
    ? hiddenControl(parentNode)
    : false;
}

function controlName(
  control: Element,
  ids: ReadonlyMap<string, Element>,
): string {
  const labelledBy = attribute(control, "aria-labelledby")?.trim().split(/\s+/);
  const labels = (labelledBy ?? [])
    .map((id) => ids.get(id))
    .filter((node) => node !== undefined);
  if (labels.length > 0)
    return normalizeText(labels.map(referencedLabel).join(" "));

  const label = markupLabel(control);
  if (label) return label;
  if (control.tagName === "area")
    return attribute(control, "alt")?.trim() ?? "";
  if (control.tagName === "input") {
    const type = inputType(control);
    if (type === "image") return attribute(control, "alt")?.trim() ?? "Submit";
    if (type === "submit" || type === "reset")
      return attribute(control, "value")?.trim() ?? type;
    if (type === "button") return attribute(control, "value")?.trim() ?? "";
  }
  return attribute(control, "title")?.trim() ?? "";
}

function assertNamedControls(page: DefaultTreeAdapterMap["document"]): void {
  const ids = new Map<string, Element>();
  for (const element of elements(
    page,
    (node) => attribute(node, "id") !== undefined,
  )) {
    const id = attribute(element, "id");
    if (id !== undefined && !ids.has(id)) ids.set(id, element);
  }
  for (const control of elements(page, isControl)) {
    if (hiddenControl(control)) continue;
    const detail =
      attribute(control, "href") ?? attribute(control, "class") ?? "";
    assert.ok(
      controlName(control, ids),
      `empty ${control.tagName} name: ${detail}`,
    );
  }
}

for (const attribute of ['aria-hidden="true"', "hidden"]) {
  test(`a referenced label whose only child has ${attribute} leaves the link unnamed`, () => {
    const page = parse(`
      <a href="/docs/" aria-labelledby="label"></a>
      <span id="label"><span ${attribute}>Docs</span></span>
    `);
    assert.throws(() => assertNamedControls(page), /empty a name: \/docs\//);
  });
}

for (const [source, markup] of [
  ["a hidden target", '<span id="label" hidden>Docs</span>'],
  ["the target's aria-label", '<span id="label" aria-label="Docs"></span>'],
  ["an image alt", '<span id="label"><img alt="Docs"></span>'],
]) {
  test(`a referenced label can name a link from ${source}`, () => {
    const page = parse(
      `<a href="/docs/" aria-labelledby="label"></a>${markup}`,
    );
    assertNamedControls(page);
  });
}

for (const { route, title, heading } of ROUTES) {
  test(`${route} publishes its title, landmarks and accessible markup`, () => {
    const page = builtPage(route);
    const [head] = byTag(page, "head");
    const [html] = byTag(page, "html");
    const [main] = byTag(page, "main");
    assert.ok(head && html, "the document has a head and root element");
    assert.deepEqual(byTag(head, "title").map(textContent), [title], "title");
    assert.ok(main && byTag(page, "main").length === 1, "one main landmark");
    assert.equal(byTag(page, "h1").length, 1, "one h1 in the document");
    assert.deepEqual(
      byTag(main, "h1").map((node) => normalizeText(textContent(node))),
      [heading],
      "the heading in main",
    );
    assert.match(attribute(html, "lang") ?? "", /\S/, "document language");
    assert.equal(byTag(page, "header").length, 1, "one header landmark");
    assert.equal(byTag(page, "footer").length, 1, "one footer landmark");

    for (const image of byTag(page, "img")) {
      assert.ok(
        attribute(image, "alt") !== undefined ||
          attribute(image, "aria-hidden") === "true",
        `image needs alt or aria-hidden: ${attribute(image, "src")}`,
      );
    }

    assertNamedControls(page);

    if (DOCS_ROUTES.has(route)) {
      const pending = byTag(page, "astro-island").filter(
        (island) => attribute(island, "ssr") !== undefined,
      );
      assert.equal(pending.length, 2, "Copy and Search await hydration");
    }
    if (route === NOT_FOUND_ROUTE) {
      const robots = byTag(head, "meta").filter(
        (meta) => attribute(meta, "name") === "robots",
      );
      assert.deepEqual(
        robots.map((meta) => attribute(meta, "content")),
        ["noindex"],
        "404 robots",
      );
    }
  });
}
