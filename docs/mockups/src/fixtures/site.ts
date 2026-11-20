/** Shared production origin for the public-site and application fixtures. */
export const siteOrigin = "https://mokly.ai";

/** Outbound destinations owned by the public site, never catalogue entries. */
export const site = {
  home: siteOrigin + "/",
  docs: siteOrigin + "/docs",
  /** The CI setup guide, which the installed package's guides publish. */
  publishFromCi: siteOrigin + "/docs/ci/publish-from-ci/",
  pricing: siteOrigin + "/pricing",
  changelog: siteOrigin + "/changelog",
  terms: siteOrigin + "/terms",
  privacy: siteOrigin + "/privacy",
} as const;

/** Outbound destinations owned by the application, never site catalogue entries. */
export const app = {
  signIn: siteOrigin + "/sign-in",
  signUp: siteOrigin + "/sign-up",
} as const;

/** The public open-source repository linked from every site header. */
export const openSource = {
  github: "https://github.com/mokly-ai/mokly",
} as const;

/** The approved publication label and review state shown above the real stage. */
export const siteStage = {
  label: "Mokly Cloud · sydney-v1",
  status: "Ready for review",
  /**
   * How many entries and folders sit directly in each folder the depicted
   * tree opens. A policy test reads them back from the catalogue manifest.
   */
  folders: { account: 10, design: 23, product: 4 },
} as const;
