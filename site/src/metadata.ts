/**
 * Per-page metadata: the canonical URL and the social card image. The image
 * is named after the route and is only advertised once the build has
 * produced it, so the link check never meets a card image that is missing.
 */

import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The directory whose PNG files the social card metadata may reference. */
export const SOCIAL_IMAGE_DIRECTORY = fileURLToPath(
  new URL("../public/og/", import.meta.url),
);

/** The canonical absolute URL of a route on the configured site origin. */
export function canonicalUrl(route: string, origin: string): string {
  return new URL(route, `${origin}/`).href;
}

/** The social card slug of a route: `/` is `index`, deeper paths join. */
export function socialSlug(route: string): string {
  const segments = route.split("/").filter((segment) => segment.length > 0);
  return segments.length === 0 ? "index" : segments.join("-");
}

/** The site path of a route's social card image. */
export function socialImagePath(route: string): string {
  return `/og/${socialSlug(route)}.png`;
}

/** The card image URL, or nothing when the build has not produced it yet. */
export function socialImageUrl(
  route: string,
  origin: string,
  available: ReadonlySet<string>,
): string | undefined {
  const slug = socialSlug(route);
  return available.has(slug)
    ? canonicalUrl(socialImagePath(route), origin)
    : undefined;
}

/** Read the card images a build has produced, tolerating an absent set. */
export function availableSocialImages(directory: string): ReadonlySet<string> {
  if (!existsSync(directory)) return new Set<string>();
  return new Set(
    readdirSync(directory)
      .filter((name) => name.endsWith(".png"))
      .map((name) => name.slice(0, -".png".length)),
  );
}
