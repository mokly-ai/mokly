import type { APIRoute } from "astro";

import { settings } from "../settings.js";
import { publishedPaths, sitemapDocument } from "../sitemap.js";

/** The sitemap every route is published in; the 404 document is excluded. */
export const GET: APIRoute = () =>
  new Response(sitemapDocument(publishedPaths(), settings.origin), {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
