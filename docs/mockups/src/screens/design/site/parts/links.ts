/** Catalogue paths and application routes the site mockups link between. */

import { openSource } from "../../../../fixtures/site";

/** Owning site screens, addressed by catalogue path. */
export const SITE_SCREENS = {
  changelog: "design/site/changelog",
  complaints: "design/site/complaints",
  docs: "design/site/docs",
  home: "design/site/home",
  pricing: "design/site/pricing",
  privacy: "design/site/privacy",
  security: "design/site/security",
  terms: "design/site/terms",
} as const;

/** One of the eight site screens in the design catalogue. */
export type SiteScreen = (typeof SITE_SCREENS)[keyof typeof SITE_SCREENS];

/** The site screens that the header and the menu list, in reading order. */
export const SITE_NAV_SCREENS: ReadonlyArray<readonly [SiteScreen, string]> = [
  [SITE_SCREENS.docs, "Docs"],
  [SITE_SCREENS.changelog, "Changelog"],
  [SITE_SCREENS.pricing, "Pricing"],
];

/** The footer's Product group, in reading order. */
export const SITE_PRODUCT_SCREENS: ReadonlyArray<
  readonly [SiteScreen, string]
> = [[SITE_SCREENS.home, "Home"], ...SITE_NAV_SCREENS];

/** Legal screens in the reading order used by the footer and policy pages. */
export const SITE_LEGAL_SCREENS: ReadonlyArray<readonly [SiteScreen, string]> =
  [
    [SITE_SCREENS.terms, "Terms"],
    [SITE_SCREENS.privacy, "Privacy"],
    [SITE_SCREENS.complaints, "Complaints"],
    [SITE_SCREENS.security, "Security"],
  ];

/**
 * The page name of each screen, which the header's file title and the
 * footer's status bar show after `mokly.ai —`.
 */
export const SITE_PAGE_NAMES: Readonly<Record<SiteScreen, string>> = {
  [SITE_SCREENS.changelog]: "Changelog",
  [SITE_SCREENS.complaints]: "Complaints",
  [SITE_SCREENS.docs]: "Docs",
  [SITE_SCREENS.home]: "Home",
  [SITE_SCREENS.pricing]: "Pricing",
  [SITE_SCREENS.privacy]: "Privacy",
  [SITE_SCREENS.security]: "Security",
  [SITE_SCREENS.terms]: "Terms",
};

/**
 * Where Get started goes. The site opens the first Getting started guide,
 * Install, which the documentation screen depicts.
 */
export const GET_STARTED_SCREEN = SITE_SCREENS.docs;

/** Public destinations outside the site and application origins. */
export const EXTERNAL_LINKS = openSource;

/** Mark a header or footer link when it addresses the rendered screen. */
export function currentPage(
  active: SiteScreen,
  screen: SiteScreen,
): "page" | undefined {
  return active === screen ? "page" : undefined;
}
