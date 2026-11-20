import type { APIRoute } from "astro";

import { changelogFeed } from "../changelog/feed.js";
import { readReleases } from "../changelog/releases.js";
import { settings } from "../settings.js";

/** The Atom feed of every release the changelog publishes. */
export const GET: APIRoute = () =>
  new Response(changelogFeed(readReleases(), settings.origin), {
    headers: { "content-type": "application/atom+xml; charset=utf-8" },
  });
