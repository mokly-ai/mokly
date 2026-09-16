import {
  APP_PATHS,
  SITE_PATHS,
  type SitePath,
  appLink,
} from "../../src/navigation.js";
import { settings } from "../../src/settings.js";

/** One published route, with the title and heading it must render. */
export interface SitePage {
  readonly route: SitePath;
  readonly title: string;
  readonly heading: string;
}

/** Every route the header and footer can reach. */
export const PAGES: readonly SitePage[] = [
  {
    route: SITE_PATHS.home,
    title: "Mokly",
    heading: "Design in your repository. Decide in the pull request.",
  },
  {
    route: SITE_PATHS.docs,
    title: "Documentation · Mokly",
    heading: "Getting started",
  },
  {
    route: SITE_PATHS.changelog,
    title: "Changelog · Mokly",
    heading: "What’s new in Mokly",
  },
  { route: SITE_PATHS.terms, title: "Terms · Mokly", heading: "Terms" },
  { route: SITE_PATHS.privacy, title: "Privacy · Mokly", heading: "Privacy" },
];

/** The heading each route must render, addressed by route. */
export const HEADINGS: ReadonlyMap<string, string> = new Map(
  PAGES.map((page) => [page.route, page.heading]),
);

/** Sign in resolves against the configured application origin. */
export const SIGN_IN = appLink(settings.appOrigin, APP_PATHS.signIn);

/** Get started resolves against the configured application origin. */
export const SIGN_UP = appLink(settings.appOrigin, APP_PATHS.signUp);

/** The width at which the desktop composition replaces the mobile one. */
export const BREAKPOINT = 768;
