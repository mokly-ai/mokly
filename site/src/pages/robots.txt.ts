import type { APIRoute } from "astro";

import { settings } from "../settings.js";
import { robotsDocument } from "../sitemap.js";

/** Allow every crawler everything and name the sitemap. */
export const GET: APIRoute = () =>
  new Response(robotsDocument(settings.origin), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
