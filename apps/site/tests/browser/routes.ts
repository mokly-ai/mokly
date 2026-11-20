import { PAGE_METADATA } from "../../src/metadata.js";
import { SITE_PATHS, type SitePath } from "../../src/navigation.js";

/** One published route, with the title and heading it must render. */
export interface SitePage {
  readonly route: SitePath;
  readonly title: string;
  readonly heading: string;
}

/** The heading each route publishes; its title comes from the page table. */
const HEADING: Readonly<Record<SitePath, string>> = {
  [SITE_PATHS.home]: "Mockup your entire app.",
  [SITE_PATHS.docs]: "Getting started",
  [SITE_PATHS.changelog]: "What’s new in Mokly",
  [SITE_PATHS.terms]: "Terms of Service",
  [SITE_PATHS.privacy]: "Privacy Policy",
  [SITE_PATHS.complaints]: "Complaints",
  [SITE_PATHS.security]: "Security",
};

/** Every route the header and footer can reach. */
export const PAGES: readonly SitePage[] = Object.values(SITE_PATHS).map(
  (route) => ({
    heading: HEADING[route],
    route,
    title: PAGE_METADATA[route].title,
  }),
);

/** The heading each route must render, addressed by route. */
export const HEADINGS: ReadonlyMap<string, string> = new Map(
  PAGES.map((page) => [page.route, page.heading]),
);

/** The width at which the desktop composition replaces the mobile one. */
export const BREAKPOINT = 768;
