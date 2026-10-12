import path from "node:path";

import type { DefaultTreeAdapterMap } from "parse5";

import {
  documentRoute,
  entryRoute,
  generatedViews,
  generatedResourcePath,
  logicalMarker,
  parseLogicalMarker,
  parseLogicalTarget,
  type ManifestEntry,
} from "@mokly/viewer/data";

import { parseHtml } from "../../diagnostics/html_parse.js";
import type { ReviewLinkNormalization } from "../ignore.js";

import { baselinePathMapper } from "./identity.js";
import { normalizeResourceLinks } from "./resource_links.js";
import type { MoveResources, MoveSide } from "./resources.js";
import type { EntryMove } from "./types.js";

type HtmlNode = DefaultTreeAdapterMap["node"];

/** Rewrite only catalogue link attributes; source documents and all other bytes stay intact. */
export function catalogueLinkNormalizer(
  before: readonly ManifestEntry[],
  after: readonly ManifestEntry[],
  moves: readonly EntryMove[],
  resources?: MoveResources,
): (beforeRoute: string, afterRoute: string) => ReviewLinkNormalization {
  const current = new Map(
    after.map((entry) => [entry.path.toLowerCase(), entry.path]),
  );
  const mapBefore = baselinePathMapper(before, after, moves);
  const mapAfter = (value: string) => current.get(value.toLowerCase()) ?? value;
  const baseRoutes = routeIndex(before);
  const headRoutes = routeIndex(after);
  const equalSource =
    sameCatalogueRoutes(before, after, baseRoutes, headRoutes) &&
    (resources?.equalSourceIdentities() ?? true);
  const base = cachedRewrite(baseRoutes, mapBefore, "before", resources);
  const head = cachedRewrite(headRoutes, mapAfter, "after", resources);
  return (beforeRoute, afterRoute) => ({
    equalSource: equalSource && beforeRoute === afterRoute,
    before: (html) => base(beforeRoute, html, afterRoute),
    after: (html) => head(afterRoute, html, beforeRoute),
  });
}

function sameCatalogueRoutes(
  before: readonly ManifestEntry[],
  after: readonly ManifestEntry[],
  base: ReadonlyMap<string, string>,
  head: ReadonlyMap<string, string>,
): boolean {
  if (before.length !== after.length || base.size !== head.size) return false;
  const kinds = new Map(after.map((entry) => [entry.path, entry.kind]));
  if (before.some((entry) => kinds.get(entry.path) !== entry.kind))
    return false;
  for (const [route, entry] of base)
    if (head.get(route) !== entry) return false;
  return true;
}

function cachedRewrite(
  routes: ReadonlyMap<string, string>,
  mapPath: (path: string) => string,
  side: MoveSide,
  resources?: MoveResources,
) {
  const documents = new Map<string, Map<string, string>>();
  return (route: string, html: string, counterpart: string): string => {
    const key = `${route}\0${counterpart}`;
    let cache = documents.get(key);
    if (!cache) {
      cache = new Map();
      documents.set(key, cache);
    }
    let normalized = cache.get(html);
    if (normalized === undefined) {
      normalized = normalizeResourceLinks(
        rewrite(html, route, routes, mapPath),
        route,
        side,
        resources,
        counterpart,
      );
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
    index.set(generatedResourcePath(entryRoute(entry.path)), entry.path);
    for (const view of generatedViews(entry))
      index.set(generatedResourcePath(view.path), entry.path);
    if (entry.kind === "document")
      for (const scheme of entry.colorSchemes)
        index.set(
          generatedResourcePath(documentRoute(entry.path, scheme)),
          entry.path,
        );
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
  visit(parseHtml("linkNormalization", html, { sourceCodeLocationInfo: true }));
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
