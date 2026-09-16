/**
 * Per-page metadata: the title and description every route publishes, its
 * canonical URL and its social card image. The image is named after the route
 * and is only advertised once the build has produced it, so the link check
 * never meets a card image that is missing.
 */

import { existsSync, readdirSync } from "node:fs";

import { SITE_PATHS, type SitePath } from "./navigation.js";
import { sitePath } from "./workspace.js";

/** The directory whose PNG files the social card metadata may reference. */
export const SOCIAL_IMAGE_DIRECTORY = sitePath("public", "og");

/** The document title and description of one route. */
export interface PageMetadata {
  readonly description: string;
  readonly title: string;
}

/** The route the not-found document publishes, which the sitemap omits. */
export const NOT_FOUND_ROUTE = "/404";

/** Every route that publishes a document, including the not-found page. */
export type PageRoute = SitePath | typeof NOT_FOUND_ROUTE;

/** Every published document, addressed by route. */
export const PAGE_METADATA: Readonly<Record<PageRoute, PageMetadata>> =
  Object.freeze({
    [SITE_PATHS.home]: {
      description:
        "Your mockups are React components in Git. Browse every branch as screens, review them with your team, and edit with an agent beside the screen.",
      title: "Mokly",
    },
    [SITE_PATHS.docs]: {
      description:
        "Documentation for the Mokly CLI, authoring, the catalogue and Mokly Cloud.",
      title: "Documentation · Mokly",
    },
    [SITE_PATHS.changelog]: {
      description: "Every release of the Mokly CLI, newest first.",
      title: "Changelog · Mokly",
    },
    [SITE_PATHS.terms]: {
      description: "Service terms for Mokly Cloud.",
      title: "Terms · Mokly",
    },
    [SITE_PATHS.privacy]: {
      description: "Privacy policy for Mokly Cloud.",
      title: "Privacy · Mokly",
    },
    [NOT_FOUND_ROUTE]: {
      description: "Start again from the home page or the documentation.",
      title: "Page not found · Mokly",
    },
  });

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
