import type { APIRoute } from "astro";

import { SITEMAP_PATHS } from "../navigation.js";
import { settings } from "../settings.js";
import { sitemapDocument } from "../sitemap.js";

/** The sitemap every route is published in; the 404 document is excluded. */
export const GET: APIRoute = () =>
  new Response(sitemapDocument(SITEMAP_PATHS, settings.origin), {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
