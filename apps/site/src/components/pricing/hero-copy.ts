/**
 * The pricing hero copy that `docs/protocol/cloud/site-pricing.md` approves.
 *
 * The hero renders it, and the pricing page's description repeats the lead.
 * Each is written once here, so a change to the hero reaches search results
 * and shared links in the same edit.
 */

/** The approved pricing hero: the kicker, the two-line heading and the lead. */
export const PRICING_HERO = {
  heading: "Free for open source.",
  headingSecondLine: "Team for private projects.",
  kicker: "Pricing",
  lead: "The Mokly CLI is free and MIT licensed. Mokly Cloud is free for public projects. Team adds private projects to the same workspace, billed monthly for the people who use it.",
} as const;
