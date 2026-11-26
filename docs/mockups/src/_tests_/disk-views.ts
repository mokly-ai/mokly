import { existsSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { defaultTreeAdapter, parse, serialize } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";

import { VIEWER_DIRECTORY } from "@mokly/viewer/data";

import { catalogueIndex } from "./catalogue-index";
import { outputRoot, screenView } from "./catalogue-paths";
import type { Scheme, Viewport } from "./catalogue-paths";
import {
  linkedCssCanShareSweep,
  normalizeColor,
  normalizeInlineCss,
  schemeAttribute,
  svgPaintAttribute,
} from "./disk-theme-css";

export interface GeneratedView {
  file: string;
  path: string;
  viewport: Viewport;
  scheme: Scheme;
}

export function generatedViews(): GeneratedView[] {
  const { screens, components } = catalogueIndex();
  return [...screens, ...components].flatMap(({ path, views }) =>
    views.map(({ viewport, colorScheme: scheme }) => ({
      file: screenView(path, viewport, scheme),
      path,
      viewport,
      scheme,
    })),
  );
}

type ReadOutput = (file: string) => string | undefined;
type CompareViews = (light: GeneratedView, dark: GeneratedView) => boolean;
type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];

const frameProbe = `/${VIEWER_DIRECTORY}/client/frame-probe.js`;
const svg = "http://www.w3.org/2000/svg";
const outputUrl = pathToFileURL(outputRoot + sep);

function readBuiltFile(file: string): string | undefined {
  const filename = resolve(outputRoot, file);
  if (existsSync(filename)) return readFileSync(filename, "utf8");
}

function attr(element: Element, name: string) {
  return element.attrs.find((attribute) => attribute.name === name);
}

/** Mokly rewrites links and navigation metadata to the target's matching view. */
function normalizeRoute(
  value: string,
  view: GeneratedView,
  url: URL,
  targets: ReadonlyMap<string, GeneratedView>,
  entry?: string,
): string {
  const target = URL.parse(value, url);
  if (target === null || target.search) return value;
  const hash = target.hash;
  target.hash = "";
  const record = targets.get(target.href);
  if (
    record?.scheme === view.scheme &&
    (entry === undefined || entry === record.path)
  )
    return `\u0000${record.path}/${record.viewport}${hash}\u0000`;
  return value;
}

export function compareBuiltViews(
  views: readonly GeneratedView[],
  readOutput: ReadOutput = readBuiltFile,
): CompareViews {
  const targets = new Map(
    views.map((view) => [new URL(view.file, outputUrl).href, view]),
  );
  const inlineStyles = new Map<string, string | undefined>();
  const linkedStyles = new Map<string, boolean>();
  const documents = new Map<string, string | undefined>();

  function inlineCss(css: string, scheme: Scheme) {
    const key = scheme + css;
    if (!inlineStyles.has(key))
      inlineStyles.set(key, normalizeInlineCss(css, scheme));
    return inlineStyles.get(key);
  }

  function safeStylesheet(element: Element, base: URL): boolean {
    const href = attr(element, "href")?.value;
    const media = attr(element, "media")?.value ?? "";
    if (!href || /prefers-color-scheme/i.test(media)) return false;
    const url = URL.parse(href, base);
    if (url === null || !url.href.startsWith(outputUrl.href)) return false;
    let file: string;
    try {
      file = relative(outputRoot, fileURLToPath(url)).split(sep).join("/");
    } catch {
      return false;
    }
    if (!linkedStyles.has(file)) {
      const css = readOutput(file);
      linkedStyles.set(file, css !== undefined && linkedCssCanShareSweep(css));
    }
    return linkedStyles.get(file) === true;
  }

  function normalizeDocument(view: GeneratedView): string | undefined {
    const html = readOutput(view.file);
    if (html === undefined) return;
    const document = parse(html);
    const url = new URL(view.file, outputUrl);

    function normalize(node: Node): boolean {
      if (defaultTreeAdapter.isElementNode(node)) {
        const { tagName } = node;
        if (["base", "embed", "frame", "iframe", "object"].includes(tagName))
          return false;
        if (
          tagName === "script" &&
          (attr(node, "src")?.value !== frameProbe || node.childNodes.length)
        )
          return false;
        if (
          tagName === "link" &&
          /\bstylesheet\b/i.test(attr(node, "rel")?.value ?? "") &&
          !safeStylesheet(node, url)
        )
          return false;
        if (tagName === "style") {
          if (/prefers-color-scheme/i.test(attr(node, "media")?.value ?? ""))
            return false;
          for (const child of node.childNodes) {
            if (!defaultTreeAdapter.isTextNode(child)) return false;
            const css = inlineCss(child.value, view.scheme);
            if (css === undefined) return false;
            child.value = css;
          }
        }
        const entry = attr(node, "data-mokly-link")?.value;
        for (const attribute of node.attrs) {
          const { name, value } = attribute;
          if (/^on[a-z]/.test(name)) return false;
          if (schemeAttribute.test(name) && value === view.scheme) {
            attribute.value = "\u0000scheme\u0000";
          } else if (
            node.namespaceURI === svg &&
            svgPaintAttribute.test(name)
          ) {
            attribute.value = normalizeColor(value);
          } else if (name === "style") {
            const css = inlineCss(value, view.scheme);
            if (css === undefined) return false;
            attribute.value = css;
          } else if (
            name === "data-nav-href" ||
            (tagName === "a" && name === "href" && entry !== undefined)
          ) {
            attribute.value = normalizeRoute(value, view, url, targets, entry);
          }
        }
      }
      return !("childNodes" in node) || node.childNodes.every(normalize);
    }

    // The linked stylesheet references stay in the serialized HTML. A pair
    // can share the sweep only if it loads the same files in the same order.
    if (normalize(document)) return serialize(document);
  }

  function signature(view: GeneratedView) {
    if (!documents.has(view.file))
      documents.set(view.file, normalizeDocument(view));
    return documents.get(view.file);
  }

  return (light, dark) => {
    const lightDocument = signature(light);
    return lightDocument !== undefined && lightDocument === signature(dark);
  };
}

export function diskSweepViews(
  views: readonly GeneratedView[],
  compare: CompareViews = compareBuiltViews(views),
): GeneratedView[] {
  const lightByFile = new Map(
    views
      .filter(({ scheme }) => scheme === "light")
      .map((view) => [view.file, view]),
  );
  return views.filter((view) => {
    if (view.scheme === "light") return true;
    const light = lightByFile.get(screenView(view.path, view.viewport));
    return light === undefined || !compare(light, view);
  });
}
