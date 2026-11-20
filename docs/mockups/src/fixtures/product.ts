/** Mockup-only facts describing this repository; never import these into the app. */
export const sample = {
  workspace: "Mokly Team",
  project: "Mokly Cloud",
  repository: "mokly-ai/mokly-cloud",
  visibility: "Private",
  config: "mokly.config.json",
  viewer: { name: "Cal", initials: "CA", email: "cal@example.com" },
} as const;

/** The current project address key, separate from its display name. */
export const project = {
  slug: "mokly-cloud",
} as const;

export const members = [
  { name: "Cal", email: "cal@example.com", role: "Owner", initials: "CA" },
  { name: "Alex", email: "alex@example.com", role: "Admin", initials: "AL" },
  { name: "Sam", email: "sam@example.com", role: "Reviewer", initials: "SA" },
] as const;

export const roles = ["Reviewer", "Member", "Admin"] as const;

export const token = {
  name: "GitHub Actions",
  prefix: "mkc_2600…",
  detail: "Created 14 Sep · last used 15 Sep",
} as const;

/**
 * The GitHub accounts Mokly Team connects, one installation of the App each:
 * the GitHub organization the team's repositories live in, then a personal
 * account. The repository step groups its select by them and the GitHub
 * accounts pane lists them, in this order.
 */
export const githubAccounts = [
  {
    name: "mokly-ai",
    kind: "Organization",
    /** GitHub's own page for the installation, where a suspension is cleared. */
    manageUrl:
      "https://github.com/organizations/mokly-ai/settings/installations/42",
    repositories: [
      { name: "mokly-ai/mokly-cloud", visibility: "Private" },
      { name: "mokly-ai/mokly", visibility: "Public" },
    ],
  },
  {
    name: "cal",
    kind: "Personal",
    manageUrl: "https://github.com/settings/installations/43",
    repositories: [{ name: "cal/release-notes", visibility: "Private" }],
  },
] as const;

/** One connected account, as the fixtures above describe it. */
export type GitHubAccount = (typeof githubAccounts)[number];

/** The workspace pane reads its GitHub accounts and the projects it owns. */
export const workspace = {
  slug: "mokly-team",
  /** What a suspended installation reads, beside the link that clears it. */
  installationSuspended: "Suspended",
  /** That account's installation on GitHub. */
  manageUrl: githubAccounts[0].manageUrl,
  projects: [
    {
      id: "cloud",
      name: "Mokly Cloud",
      slug: project.slug,
      repository: "mokly-ai/mokly-cloud",
    },
    {
      id: "site",
      name: "Mokly Site",
      slug: "mokly-site",
      repository: "mokly-ai/mokly",
    },
  ],
} as const;

/** Readable addresses shown in forms and project rows. */
export const addresses = {
  root: "mokly.ai",
  workspace: "mokly.ai/" + workspace.slug,
  project: "mokly.ai/" + workspace.slug + "/" + project.slug,
} as const;
