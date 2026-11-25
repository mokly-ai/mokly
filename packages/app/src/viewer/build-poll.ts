/**
 * How often the card reads a build that is still working, and its log. Three
 * seconds keeps live output live without a request a second per open tab, and
 * a hidden tab reads nothing at all.
 */
export const buildPollIntervalMs = 3_000;
