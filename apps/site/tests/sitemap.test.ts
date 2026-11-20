import assert from "node:assert/strict";
import test from "node:test";

import { SITEMAP_PATHS, SITE_PATHS } from "../src/navigation.js";
import { robotsDocument, sitemapDocument } from "../src/sitemap.js";

test("the sitemap lists every published route as an absolute URL", () => {
  const document = sitemapDocument(SITEMAP_PATHS, "https://example.com");
  assert.match(document, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n/);
  assert.match(
    document,
    /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/,
  );
  for (const route of Object.values(SITE_PATHS)) {
    assert.ok(
      document.includes(`<loc>https://example.com${route}</loc>`),
      route,
    );
  }
  assert.doesNotMatch(document, /404/);
  assert.equal(document.match(/<url>/g)?.length, SITEMAP_PATHS.length);
});

test("the sitemap escapes markup in a route", () => {
  assert.match(
    sitemapDocument(["/a&b/"], "https://example.com"),
    /<loc>https:\/\/example\.com\/a&amp;b\/<\/loc>/,
  );
});

test("robots allows everything and names the sitemap", () => {
  assert.equal(
    robotsDocument("https://example.com"),
    "User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml\n",
  );
});
