/**
 * Rewrite the dogfood catalogue's screen documents so they can be published
 * from one flat directory inside the site output.
 *
 * Inline local stylesheets in document order so the frame has its styles
 * before layout. Chrome can count an early layout as a layout shift.
 * Publish stylesheet dependencies beside each document.
 *
 * Catalogue destinations that the site does not publish lose their href
 * because the stage frame is sandboxed and cannot navigate.
 *
 * The caller supplies the stylesheet text. The functions perform no input
 * or output, so tests can check the rewriting rules directly.
 */

import {
  type DefaultTreeAdapterMap,
  defaultTreeAdapter,
  parse,
  serialize,
} from "parse5";

import {
  local,
  rebaseStylesheet,
  resolve,
  safeTarget,
  stylesheetResources,
} from "./stylesheets.js";

/** A screen document read from the dogfood catalogue output. */
export interface StageSource {
  /** The document's path inside the dogfood output, used to resolve links. */
  readonly path: string;
  /** The document's markup. */
  readonly html: string;
}

/** The rewritten stage, keyed by the file name each document takes. */
export interface StageRewrite {
  /** Rewritten markup for every screen document, by published file name. */
  readonly documents: ReadonlyMap<string, string>;
  /** Every resource to copy, by published file name, as a source path. */
  readonly resources: ReadonlyMap<string, string>;
  /** The screen's title, read from the document rather than configured. */
  readonly title: string;
}

const RESOURCE_TAGS = new Set([
  "audio",
  "embed",
  "iframe",
  "img",
  "link",
  "object",
  "script",
  "source",
  "track",
  "video",
]);

const REFERENCE_ATTRIBUTES = new Set(["href", "src", "poster", "data"]);

const UNSUPPORTED_ATTRIBUTES = new Set(["srcset", "imagesrcset"]);

type Element = DefaultTreeAdapterMap["element"];

type StylesheetReader = (path: string) => string;

interface StageTree {
  readonly file: string;
  readonly source: string;
  readonly tree: DefaultTreeAdapterMap["document"];
  readonly elements: readonly Element[];
}

function elements(node: DefaultTreeAdapterMap["node"]): Element[] {
  const found: Element[] = [];
  const visit = (current: DefaultTreeAdapterMap["node"]): void => {
    if ("tagName" in current) found.push(current);
    if ("childNodes" in current) current.childNodes.forEach(visit);
    if ("content" in current) visit(current.content);
  };
  visit(node);
  return found;
}

function text(element: Element): string {
  return element.childNodes
    .map((child) => ("value" in child ? child.value : ""))
    .join("");
}

function assertNoEmbeddedUrls(element: Element, source: string): void {
  const inline =
    element.tagName === "style"
      ? text(element)
      : (element.attrs.find((attribute) => attribute.name === "style")?.value ??
        "");
  for (const [, reference] of inline.matchAll(
    /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi,
  )) {
    if (local(reference ?? "")) {
      throw new Error(
        `${source}: the stage cannot publish the embedded stylesheet reference ${JSON.stringify(reference ?? "")}. Extend scripts/stage/fragments.ts to copy it.`,
      );
    }
  }
}

function shouldInlineStylesheet(element: Element): boolean {
  if (
    element.tagName !== "link" ||
    element.attrs.some(({ name }) => name === "disabled")
  )
    return false;
  const rel = element.attrs.find(({ name }) => name === "rel")?.value ?? "";
  const tokens = rel.toLowerCase().split(/[\t\n\f\r ]+/);
  return tokens.includes("stylesheet") && !tokens.includes("alternate");
}

function readLinkedStylesheet(
  source: string,
  target: string,
  readStylesheet: StylesheetReader,
): string {
  try {
    return readStylesheet(target);
  } catch (cause) {
    throw new Error(
      `${source}: the stage cannot read the stylesheet ${JSON.stringify(target)}.`,
      { cause },
    );
  }
}

function inlineStylesheet(element: Element, css: string): void {
  const parent = element.parentNode;
  if (!parent) return;
  const attrs = element.attrs.filter(
    ({ name }) => name !== "rel" && name !== "href",
  );
  const style = defaultTreeAdapter.createElement(
    "style",
    element.namespaceURI,
    attrs,
  );
  // parse5 serializes style text raw. Escape closing tag prefixes for HTML.
  defaultTreeAdapter.insertText(style, css.replace(/<(?=\/style)/gi, "<\\"));
  defaultTreeAdapter.insertBefore(parent, style, element);
  defaultTreeAdapter.detachNode(element);
}

/** Collect the resources to copy and the CSS to inline before rewriting links. */
function collect(
  trees: readonly StageTree[],
  readStylesheet: StylesheetReader,
) {
  const resources = new Map<string, string>();
  const stylesheets = new Map<Element, string>();
  for (const { source, elements } of trees) {
    for (const element of elements) {
      assertNoEmbeddedUrls(element, source);
      const inline = shouldInlineStylesheet(element);
      for (const { name, value } of element.attrs) {
        if (UNSUPPORTED_ATTRIBUTES.has(name) && local(value)) {
          throw new Error(
            `${source}: the stage cannot publish the responsive source ${JSON.stringify(value)}.`,
          );
        }
        if (!REFERENCE_ATTRIBUTES.has(name)) continue;
        if (!RESOURCE_TAGS.has(element.tagName) || !local(value)) continue;
        const target = safeTarget(source, value);
        if (inline && name === "href") {
          const css = readLinkedStylesheet(source, target, readStylesheet);
          for (const dependency of stylesheetResources(target, css)) {
            resources.set(dependency, dependency);
          }
          stylesheets.set(element, rebaseStylesheet(target, css));
          continue;
        }
        const file = target;
        const previous = resources.get(file);
        if (previous !== undefined && previous !== target) {
          throw new Error(
            `The stage cannot publish ${target} and ${previous} under the same name ${file}.`,
          );
        }
        resources.set(file, target);
      }
    }
  }
  return { resources, stylesheets };
}

function identify(
  found: readonly Element[],
  source: string,
): { title: string } {
  const titleElement = found.find((element) => element.tagName === "title");
  const title = titleElement ? text(titleElement).trim() : "";
  const main = found.find((element) => element.tagName === "main");
  if (!title || !main) {
    throw new Error(
      `${source}: the stage needs a screen document with a title and a main landmark.`,
    );
  }
  return { title };
}

/**
 * Rewrite every document so its resources and its own alternate documents
 * resolve inside the stage directory, and drop the destinations the site does
 * not publish. `sources` is keyed by the file name each document takes.
 */
export function rewriteStage(
  sources: ReadonlyMap<string, StageSource>,
  readStylesheet: StylesheetReader,
): StageRewrite {
  const trees = [...sources].map(([file, source]) => {
    const tree = parse(source.html);
    return { file, source: source.path, tree, elements: elements(tree) };
  });
  const { resources, stylesheets } = collect(trees, readStylesheet);
  const published = new Map<string, string>([
    ...[...resources].map(([file, target]) => [target, file] as const),
    ...[...sources].map(([file, source]) => [source.path, file] as const),
  ]);
  const documents = new Map<string, string>();
  for (const { file, source, tree, elements } of trees) {
    for (const element of elements) {
      const css = stylesheets.get(element);
      if (css !== undefined) {
        inlineStylesheet(element, css);
        continue;
      }
      element.attrs = element.attrs.flatMap((attribute) => {
        if (
          !REFERENCE_ATTRIBUTES.has(attribute.name) ||
          !local(attribute.value)
        )
          return [attribute];
        const target = published.get(resolve(source, attribute.value));
        if (target !== undefined)
          return [{ ...attribute, value: `./${target}` }];
        if (RESOURCE_TAGS.has(element.tagName)) {
          throw new Error(
            `${source}: the stage cannot resolve the resource ${JSON.stringify(attribute.value)}.`,
          );
        }
        return [];
      });
    }
    documents.set(file, serialize(tree));
  }
  const [first] = trees;
  if (!first) throw new Error("The stage needs at least one screen document.");
  return { documents, resources, ...identify(first.elements, first.source) };
}
