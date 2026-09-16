/**
 * The crawler documents: `sitemap.xml` and `robots.txt`. Both are built from
 * the route table and the configured site origin, so a deployment that
 * changes its origin publishes matching absolute URLs.
 */

import { canonicalUrl } from "./metadata.js";

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
