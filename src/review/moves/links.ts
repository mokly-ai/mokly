import path from "node:path";

import { parse, type DefaultTreeAdapterMap } from "parse5";

import {
  documentRoute,
  entryRoute,
  generatedViews,
  logicalMarker,
  parseLogicalMarker,
  parseLogicalTarget,
  type ManifestEntry,
} from "@mokly/viewer/data";

import type { ReviewLinkNormalization } from "../ignore.js";

import { baselinePathMapper } from "./identity.js";
import type { EntryMove } from "./types.js";

type HtmlNode = DefaultTreeAdapterMap["node"];

/** Rewrite only catalogue link attributes; source documents and all other bytes stay intact. */
export function catalogueLinkNormalizer(
  before: readonly ManifestEntry[],
  after: readonly ManifestEntry[],
  moves: readonly EntryMove[],
): (beforeRoute: string, afterRoute: string) => ReviewLinkNormalization {
  const current = new Map(
    after.map((entry) => [entry.path.toLowerCase(), entry.path]),
  );
  const mapBefore = baselinePathMapper(before, after, moves);
  const mapAfter = (value: string) => current.get(value.toLowerCase()) ?? value;
  const baseRoutes = routeIndex(before);
  const headRoutes = routeIndex(after);
  const base = cachedRewrite(baseRoutes, mapBefore);
  const head = cachedRewrite(headRoutes, mapAfter);
  return (beforeRoute, afterRoute) => ({
    before: (html) => base(beforeRoute, html),
    after: (html) => head(afterRoute, html),
  });
}

function cachedRewrite(
  routes: ReadonlyMap<string, string>,
  mapPath: (path: string) => string,
) {
  const documents = new Map<string, Map<string, string>>();
  return (route: string, html: string): string => {
    let cache = documents.get(route);
    if (!cache) {
      cache = new Map();
      documents.set(route, cache);
    }
    let normalized = cache.get(html);
    if (normalized === undefined) {
      normalized = rewrite(html, route, routes, mapPath);
      cache.set(html, normalized);
    }
    return normalized;
  };
}

function routeIndex(
  entries: readonly ManifestEntry[],
): ReadonlyMap<string, string> {
  const index = new Map<string, string>();
  for (const entry of entries) {
    index.set(entryRoute(entry.path), entry.path);
    for (const view of generatedViews(entry)) index.set(view.path, entry.path);
    if (entry.kind === "document")
      for (const scheme of entry.colorSchemes)
        index.set(documentRoute(entry.path, scheme), entry.path);
  }
  return index;
}

function rewrite(
  html: string,
  sourceRoute: string,
  routes: ReadonlyMap<string, string>,
  canonicalPath: (path: string) => string,
): string {
  if (!/href|data-mokly-link/i.test(html)) return html;
  const patches: { start: number; end: number; value: string }[] = [];
  const visit = (node: HtmlNode): void => {
    if ("attrs" in node) {
      const marker = node.attrs.find((attr) => attr.name === "data-mokly-link");
      const destination = marker ? parseLogicalMarker(marker.value) : undefined;
      for (const attr of node.attrs) {
        const name = attr.prefix ? `${attr.prefix}:${attr.name}` : attr.name;
        if (
          name !== "data-mokly-link" &&
          name !== "data-nav-href" &&
          !(
            (node.tagName === "a" || node.tagName === "area") &&
            (name === "href" || name === "xlink:href")
          )
        )
          continue;
        const target =
          destination ?? resolveTarget(attr.value, sourceRoute, routes);
        const location = node.sourceCodeLocation?.attrs?.[name];
        if (!target || !location) continue;
        const logical = logicalMarker({
          ...target,
          path: canonicalPath(target.path),
        });
        const value = name === "data-mokly-link" ? logical : `mock:${logical}`;
        patches.push({
          start: location.startOffset,
          end: location.endOffset,
          value: `${name}="${value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`,
        });
      }
    }
    if ("childNodes" in node) for (const child of node.childNodes) visit(child);
    if ("content" in node) visit(node.content);
  };
  visit(parse(html, { sourceCodeLocationInfo: true }));
  for (const patch of patches.sort((a, b) => b.start - a.start))
    html = html.slice(0, patch.start) + patch.value + html.slice(patch.end);
  return html;
}

function resolveTarget(
  value: string,
  source: string,
  routes: ReadonlyMap<string, string>,
) {
  if (value.startsWith("mock:")) return parseLogicalTarget(value);
  if (!value || /^(?:#|\/|[A-Za-z][A-Za-z\d+.-]*:)/.test(value)) return;
  const [file, fragment] = value.split("#", 2);
  if (file!.includes("?")) return;
  try {
    const route = path.posix.normalize(
      path.posix.join(path.posix.dirname(source), decodeURIComponent(file!)),
    );
    const target = routes.get(route);
    if (!target) return;
    return {
      path: target,
      ...(fragment ? { fragment: decodeURIComponent(fragment) } : {}),
    };
  } catch {
    return;
  }
}
