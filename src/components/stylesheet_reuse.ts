import fs from "node:fs";
import path from "node:path";

import { parse, type DefaultTreeAdapterMap } from "parse5";

import { stylesheetLink } from "./stylesheet_links.js";

type Node = DefaultTreeAdapterMap["node"];

/** First renderer-authored public link for each declared real file. */
export function rendererStylesheetPaths(
  html: string,
  route: string,
  mockupsDir: string,
  declaredPhysicalPaths: ReadonlySet<string>,
  configuredHrefs: readonly string[] = [],
): Map<string, string> {
  const first = new Map<string, string>();
  const preferred = new Map<string, { index: number; publicPath: string }>();
  const document = parse(html);
  function visit(node: Node, inHead: boolean): void {
    const head = inHead || ("tagName" in node && node.tagName === "head");
    if (head && stylesheetLink(node)) {
      const href = node.attrs.find(
        (attribute) => attribute.name === "href",
      )?.value;
      if (href) {
        const file = publicFileFromHref(href, route, mockupsDir);
        if (file && declaredPhysicalPaths.has(file.physicalPath))
          if (!first.has(file.physicalPath))
            first.set(file.physicalPath, file.publicPath);
        const configuredIndex = configuredHrefs.indexOf(href);
        if (
          file &&
          configuredIndex >= 0 &&
          configuredIndex <
            (preferred.get(file.physicalPath)?.index ?? Infinity)
        )
          preferred.set(file.physicalPath, {
            index: configuredIndex,
            publicPath: file.publicPath,
          });
      }
    }
    if ("childNodes" in node)
      for (const child of node.childNodes) visit(child, head);
  }
  visit(document, false);
  return new Map(
    [...first].map(([physical, publicPath]) => [
      physical,
      preferred.get(physical)?.publicPath ?? publicPath,
    ]),
  );
}

export function publicFileFromHref(
  href: string,
  route: string,
  mockupsDir: string,
): { physicalPath: string; publicPath: string } | undefined {
  try {
    const origin = "http://mokly.invalid";
    const url = new URL(href, `${origin}/${route}`);
    if (url.origin !== origin) return;
    const publicPath = decodeURIComponent(url.pathname).slice(1);
    const candidate = path.resolve(mockupsDir, publicPath);
    const relative = path.relative(mockupsDir, candidate);
    if (
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative) ||
      !fs.existsSync(candidate)
    )
      return;
    return { physicalPath: fs.realpathSync(candidate), publicPath };
  } catch {
    return;
  }
}
