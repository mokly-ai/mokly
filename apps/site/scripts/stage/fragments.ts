/**
 * Rewrite the dogfood catalogue's screen documents so they can be published
 * from one flat directory inside the site output. Stylesheets and other
 * resources move beside the document; catalogue destinations that the site
 * does not publish lose their href, because the stage frame is sandboxed and
 * cannot navigate. The functions here perform no input or output so the
 * rewriting rules can be tested directly.
 */

import path from "node:path";

import type { DefaultTreeAdapterMap } from "parse5";
import { parse, serialize } from "parse5";

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

/** A reference the site publishes with the document, or nothing. */
function local(reference: string): boolean {
  return (
    reference.length > 0 &&
    !reference.startsWith("#") &&
    !/^[a-z][a-z0-9+.-]*:/i.test(reference) &&
    !reference.startsWith("//")
  );
}

function safeTarget(source: string, reference: string): string {
  const target = resolve(source, reference);
  if (
    target === ".." ||
    target.startsWith("../") ||
    path.posix.isAbsolute(target)
  ) {
    throw new Error(
      `${source}: the stage resource ${JSON.stringify(reference)} escapes the catalogue output`,
    );
  }
  return target;
}

/** Local resources referenced by a stylesheet, resolved from catalogue root. */
export function stylesheetResources(
  source: string,
  css: string,
): readonly string[] {
  const references = [
    ...[...css.matchAll(/@import\s+["']([^"']+)["']/gi)].map(
      (match) => match[1] ?? "",
    ),
    ...[...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map(
      (match) => match[1] ?? "",
    ),
  ];
  return [...new Set(references)]
    .filter(local)
    .map((reference) => safeTarget(source, reference));
}

function resolve(source: string, reference: string): string {
  const [target] = reference.split("#");
  if (target?.startsWith("/")) return path.posix.normalize(target.slice(1));
  return path.posix.normalize(
    path.posix.join(path.posix.dirname(source), target ?? ""),
  );
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

/** Every resource the documents load, by the flat file name it will take. */
function collect(
  sources: ReadonlyMap<string, StageSource>,
): Map<string, string> {
  const resources = new Map<string, string>();
  for (const [, source] of sources) {
    for (const element of elements(parse(source.html))) {
      assertNoEmbeddedUrls(element, source.path);
      for (const { name, value } of element.attrs) {
        if (UNSUPPORTED_ATTRIBUTES.has(name) && local(value)) {
          throw new Error(
            `${source.path}: the stage cannot publish the responsive source ${JSON.stringify(value)}.`,
          );
        }
        if (!REFERENCE_ATTRIBUTES.has(name)) continue;
        if (!RESOURCE_TAGS.has(element.tagName) || !local(value)) continue;
        const target = safeTarget(source.path, value);
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
  return resources;
}

function identify(html: string, source: string): { title: string } {
  const found = elements(parse(html));
  const title = text(
    found.find((element) => element.tagName === "title") ??
      ({ childNodes: [] } as unknown as Element),
  ).trim();
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
): StageRewrite {
  const resources = collect(sources);
  const published = new Map<string, string>([
    ...[...resources].map(([file, target]) => [target, file] as const),
    ...[...sources].map(([file, source]) => [source.path, file] as const),
  ]);
  const documents = new Map<string, string>();
  for (const [file, source] of sources) {
    const tree = parse(source.html);
    for (const element of elements(tree)) {
      element.attrs = element.attrs.flatMap((attribute) => {
        if (
          !REFERENCE_ATTRIBUTES.has(attribute.name) ||
          !local(attribute.value)
        )
          return [attribute];
        const target = published.get(resolve(source.path, attribute.value));
        if (target !== undefined)
          return [{ ...attribute, value: `./${target}` }];
        if (RESOURCE_TAGS.has(element.tagName)) {
          throw new Error(
            `${source.path}: the stage cannot resolve the resource ${JSON.stringify(attribute.value)}.`,
          );
        }
        return [];
      });
    }
    documents.set(file, serialize(tree));
  }
  const [first] = [...sources.values()];
  if (!first) throw new Error("The stage needs at least one screen document.");
  return { documents, resources, ...identify(first.html, first.path) };
}
