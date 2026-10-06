import fs from "node:fs/promises";
import path from "node:path";

import postcss from "postcss";
import valueParser from "postcss-value-parser";

import {
  attribute,
  documentElements,
  textContent,
  type HtmlElement,
} from "./html.js";

/** The outcome of one audit of generated resource references. */
export interface ResourceReferenceAudit {
  failures: string[];
  htmlFiles: number;
  stylesheetLinks: number;
}

interface Reference {
  where: string;
  value: string;
}

const LINK_RELS: ReadonlySet<string> = new Set([
  "icon",
  "modulepreload",
  "preload",
  "stylesheet",
]);
const SRC_TAGS: ReadonlySet<string> = new Set([
  "audio",
  "embed",
  "iframe",
  "img",
  "source",
  "track",
  "video",
]);
const SRCSET_TAGS: ReadonlySet<string> = new Set(["img", "source"]);
const SVG_HREF_TAGS: ReadonlySet<string> = new Set(["image", "use"]);

function urlArguments(value: string, where: string): Reference[] {
  const references: Reference[] = [];
  valueParser(value).walk((node) => {
    if (node.type === "function" && node.value.toLowerCase() === "url")
      references.push({ where, value: node.nodes[0]?.value ?? "" });
  });
  return references;
}

function importTarget(params: string): string {
  const [first] = valueParser(params).nodes.filter(
    (node) => node.type !== "space",
  );
  if (first?.type === "string") return first.value;
  if (first?.type === "function" && first.value.toLowerCase() === "url")
    return first.nodes[0]?.value ?? "";
  return "";
}

/**
 * Candidate URLs as the HTML `srcset` rules read them: a URL is a run of
 * non-whitespace characters, and its descriptors end at the next comma.
 */
function srcsetUrls(value: string): string[] {
  const urls: string[] = [];
  let rest = value;
  for (;;) {
    rest = rest.replace(/^[\s,]+/u, "");
    const url = /^\S+/u.exec(rest)?.[0];
    if (url === undefined) return urls;
    rest = rest.slice(url.length);
    if (url.endsWith(",")) urls.push(url.replace(/,+$/u, ""));
    else {
      urls.push(url);
      const comma = rest.indexOf(",");
      rest = comma === -1 ? "" : rest.slice(comma + 1);
    }
  }
}

function stylesheetReferences(source: string, prefix: string): Reference[] {
  const references: Reference[] = [];
  const root = postcss.parse(source);
  root.walkAtRules((rule) => {
    if (rule.name.toLowerCase() === "import")
      references.push({
        where: `${prefix}@import`,
        value: importTarget(rule.params),
      });
  });
  root.walkDecls((declaration) => {
    references.push(...urlArguments(declaration.value, `${prefix}url()`));
  });
  return references;
}

function elementReferences(element: HtmlElement): Reference[] {
  const tag = element.tagName;
  const named = (name: string) => {
    const value = attribute(element, name);
    return value === undefined ? [] : [{ where: `${tag}[${name}]`, value }];
  };
  const references: Reference[] = [];
  if (tag === "link") {
    const rels = (attribute(element, "rel") ?? "").toLowerCase().split(/\s+/u);
    if (rels.some((rel) => LINK_RELS.has(rel)))
      references.push(...named("href"));
  }
  const inputImage =
    tag === "input" && attribute(element, "type")?.toLowerCase() === "image";
  if (SRC_TAGS.has(tag) || inputImage) references.push(...named("src"));
  if (SRCSET_TAGS.has(tag))
    for (const value of srcsetUrls(attribute(element, "srcset") ?? ""))
      references.push({ where: `${tag}[srcset]`, value });
  if (tag === "video") references.push(...named("poster"));
  if (tag === "object") references.push(...named("data"));
  if (SVG_HREF_TAGS.has(tag))
    for (const attr of element.attrs.filter(({ name }) => name === "href"))
      references.push({
        where: `${tag}[${attr.prefix ? `${attr.prefix}:` : ""}href]`,
        value: attr.value,
      });
  if (tag === "style")
    references.push(...stylesheetReferences(textContent(element), "<style> "));
  const style = attribute(element, "style");
  if (style !== undefined)
    references.push(...urlArguments(style, "[style] url()"));
  return references;
}

function isStylesheetLink(element: HtmlElement): boolean {
  const rels = (attribute(element, "rel") ?? "").toLowerCase().split(/\s+/u);
  return element.tagName === "link" && rels.includes("stylesheet");
}

async function problem(
  root: string,
  file: string,
  value: string,
  isFile: (target: string) => Promise<boolean>,
): Promise<string | undefined> {
  const trimmed = value.trim();
  if (
    trimmed === "" ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("//") ||
    /^[a-z][a-z\d+.-]*:/iu.test(trimmed)
  )
    return undefined;
  if (trimmed.startsWith("/")) return "root-absolute";
  let decoded: string;
  try {
    decoded = decodeURIComponent(trimmed.split(/[?#]/u)[0] ?? "");
  } catch {
    return "missing file";
  }
  const target = path.resolve(path.dirname(file), decoded);
  const relative = path.relative(root, target);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    return "outside the generated root";
  return (await isFile(target)) ? undefined : "missing file";
}

/**
 * Check local references in HTML and CSS beneath the catalogue root. Explicit
 * inputs cover the generated tree and authored closure; synthetic sites scan all.
 */
export async function auditGeneratedResourceReferences(
  root: string,
  inputFiles?: readonly string[],
): Promise<ResourceReferenceAudit> {
  const files = [
    ...new Set(inputFiles ?? (await fs.readdir(root, { recursive: true }))),
  ]
    .filter((file) => file.endsWith(".html") || file.endsWith(".css"))
    .sort();
  const known = new Map<string, Promise<boolean>>();
  const isFile = (target: string) => {
    let result = known.get(target);
    if (!result) {
      result = fs.stat(target).then(
        (stats) => stats.isFile(),
        () => false,
      );
      known.set(target, result);
    }
    return result;
  };
  const audit: ResourceReferenceAudit = {
    failures: [],
    htmlFiles: 0,
    stylesheetLinks: 0,
  };
  for (const file of files) {
    const absolute = path.join(root, file);
    const source = await fs.readFile(absolute, "utf8");
    let references: Reference[];
    if (file.endsWith(".html")) {
      const elements = documentElements(source, () => true);
      audit.htmlFiles += 1;
      audit.stylesheetLinks += elements.filter(isStylesheetLink).length;
      references = elements.flatMap(elementReferences);
    } else references = stylesheetReferences(source, "");
    for (const { where, value } of references) {
      const reason = await problem(root, absolute, value, isFile);
      if (reason)
        audit.failures.push(
          `${file.split(path.sep).join("/")}: ${where} ${value} (${reason})`,
        );
    }
  }
  audit.failures.sort();
  return audit;
}
