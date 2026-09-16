/**
 * The crawler documents: `sitemap.xml` and `robots.txt`. Both are built from
 * the route table and the configured site origin, so a deployment that
 * changes its origin publishes matching absolute URLs.
 */

import { DOCS_PAGES } from "./docs/pages.js";
import { canonicalUrl } from "./metadata.js";
import { SITEMAP_PATHS } from "./navigation.js";

/** Escape the five XML entities so a route can never break the document. */
function escapeXml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[character] ?? character,
  );
}

/**
 * Every indexed route: the site's own pages followed by the documentation,
 * which is generated from the content collection rather than the route table.
 */
export function publishedPaths(): readonly string[] {
  return [...SITEMAP_PATHS, ...DOCS_PAGES.map((page) => page.route)];
}

/** The sitemap listing every indexed route as an absolute URL. */
export function sitemapDocument(
  paths: readonly string[],
  origin: string,
): string {
  const entries = paths.map(
    (path) =>
      `  <url><loc>${escapeXml(canonicalUrl(path, origin))}</loc></url>`,
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");
}

/** Allow every crawler everything and name the sitemap by absolute URL. */
export function robotsDocument(origin: string): string {
  return [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${canonicalUrl("/sitemap.xml", origin)}`,
    "",
  ].join("\n");
}
