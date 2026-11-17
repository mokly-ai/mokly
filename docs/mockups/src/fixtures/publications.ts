import { compareBytewise } from "./api-order";
import type { BuildName } from "./builds";
import { githubAccounts, members, workspace, sample } from "./product";

/** How a publication reads in a switcher row, a history row and the chrome. */
export type PublicationState = "ready" | "publishing" | "failed" | "none";

/** The status tone each publication state takes in a row's decorative dot. */
export const publicationTones = {
  ready: "success",
  publishing: "warning",
  failed: "danger",
  none: "neutral",
} as const satisfies Record<
  PublicationState,
  "neutral" | "success" | "warning" | "danger"
>;

/**
 * One reference the viewer can select, with the publication it resolves to.
 *
 * `listBranches` and `listPullRequests` carry a name, the newest ready
 * publication, the newest publication attempt, the newest build and an update
 * time. A row's state, detail and SHA are the newer of that attempt and that
 * build, so an active build reads Publishing even over a ready publication;
 * `ready` says whether a ready publication exists, because opening the row
 * still resolves to it.
 */
export interface PublicationRef {
  id: string;
  name: string;
  state: PublicationState;
  detail: string;
  sha?: string;
  ready: boolean;
  /**
   * The build the row takes its state and SHA from, when that build is newer
   * than the reference's newest publication.
   */
  build?: BuildName;
}

/**
 * The branch the standalone viewer is reading and its current publication,
 * whose SHA the chrome, history and Share show. Its switcher row shows the
 * head of the build publishing a newer push instead.
 */
export const publication = {
  branch: "calummoore/sydney-v1",
  sha: "72d6047",
  published: "Published 15 Sep",
  time: "15 Sep, 14:20",
} as const;

/** The pull request entry a check link resolves to; Alex opened it, not Cal. */
export const pullRequest = {
  number: "#1",
  title: "Mokly Cloud initial scope",
  author: members[1].name,
  sha: "9c2f5ae",
  published: "Published 15 Sep, 16:04",
  view: "Changes",
  github: "https://github.com/" + sample.repository + "/pull/1",
} as const;

/** Cal's own pull request, whose first build is still running. */
export const buildingPullRequest = {
  number: "#2",
  title: "Catalogue hosting",
  author: members[0].name,
  github: "https://github.com/" + sample.repository + "/pull/2",
} as const;

/**
 * Alex's pull request, closed after its build failed. Nothing was published
 * for it, and a closed pull request gets no new build.
 */
export const closedPullRequest = {
  number: "#3",
  title: "Retry failed uploads",
  author: members[1].name,
  github: "https://github.com/" + sample.repository + "/pull/3",
} as const;

/**
 * Sam's pull request from a fork. Builds never run for a fork, so its screens
 * are reviewed locally: open, its alias shows the fork card, and once it was
 * merged with nothing published, the closed card.
 */
export const forkPullRequest = {
  number: "#4",
  title: "Clarify the CI guide",
  author: members[2].name,
  github: "https://github.com/" + sample.repository + "/pull/4",
} as const;

/** The bound repository's default branch, which `listBranches` lists first. */
const defaultBranch = "main";

/**
 * Every branch, with every state among them, in no particular order. A
 * drawing reads `listedBranches`, which has the API's order. The branch Cal is
 * reading has a build running on a newer push, so its row reads Publishing
 * while opening it still resolves to its ready publication. Two branches with
 * nothing ready read Unable to publish: one whose newest attempt is a failed
 * publication, and Alex's Bun branch, whose newest build failed. Alex's
 * onboarding branch reads it too, because its newest publication failed, but
 * opening it still resolves to its earlier ready publication.
 */
export const branches = [
  {
    id: "main",
    name: defaultBranch,
    state: "ready",
    detail: "Published 15 Sep",
    sha: "3e81b6c",
    ready: true,
  },
  {
    id: "sydney",
    name: publication.branch,
    state: "publishing",
    detail: "Publishing now",
    sha: "5d2e9a1",
    ready: true,
    build: "running",
  },
  {
    id: "firna",
    name: "calummoore/firna-controls",
    state: "ready",
    detail: "Published 14 Sep",
    sha: "a41c8b2",
    ready: true,
  },
  {
    id: "protocol",
    name: "calummoore/protocol-docs",
    state: "failed",
    detail: "Unable to publish",
    sha: "6b90f14",
    ready: false,
  },
  {
    id: "bun",
    name: "alex/bun-migration",
    state: "failed",
    detail: "Unable to publish",
    sha: "4c19e7b",
    ready: false,
    build: "lockfile",
  },
  {
    id: "onboarding",
    name: "alex/onboarding-copy",
    state: "failed",
    detail: "Unable to publish",
    sha: "8d5f2c9",
    ready: true,
  },
  {
    id: "rotation",
    name: "alex/token-rotation",
    state: "none",
    detail: "No publication yet",
    ready: false,
  },
] as const satisfies readonly PublicationRef[];

/**
 * The branches in the order that `listBranches` returns them, which the
 * switcher draws: the default branch first, then the other names in bytewise
 * ascending order.
 */
export const listedBranches: readonly PublicationRef[] = [
  ...branches.filter(({ name }) => name === defaultBranch),
  ...branches
    .filter(({ name }) => name !== defaultBranch)
    .toSorted((left, right) => compareBytewise(left.name, right.name)),
];

/** The second pull request's first build is running, with nothing ready yet. */
export const pullRequests = [
  {
    id: "pull-1",
    name: pullRequest.number + " " + pullRequest.title,
    state: "ready",
    detail: pullRequest.author + " · Published 15 Sep",
    sha: pullRequest.sha,
    ready: true,
  },
  {
    id: "pull-2",
    name: buildingPullRequest.number + " " + buildingPullRequest.title,
    state: "publishing",
    detail: buildingPullRequest.author + " · Publishing now",
    sha: "b7d3e10",
    ready: false,
    build: "pullRequest",
  },
] as const satisfies readonly PublicationRef[];

/**
 * One publication in a branch's history, newest first. `listPublications`
 * returns no author, so a row says when it was admitted, what became of it and
 * which commit it came from, and nothing the cloud cannot read.
 */
export interface PublicationRecord {
  sha: string;
  state: PublicationState;
  time: string;
  current?: boolean;
}

/** This branch's publications, newest first; the head is the current one. */
export const history: readonly PublicationRecord[] = [
  {
    sha: publication.sha,
    state: "ready",
    time: publication.time,
    current: true,
  },
  { sha: "5a1f9c3", state: "ready", time: "15 Sep, 09:12" },
  { sha: "e0c4d78", state: "failed", time: "14 Sep, 18:40" },
  { sha: "b62a015", state: "ready", time: "14 Sep, 11:05" },
];

/**
 * What a reader can do about a publication that did not arrive. The reviewer's
 * half of the message only: the developer's half — paths, versions, validation
 * names — stays in the check run and the CLI. `viewer/failure.ts` owns it.
 */
export const failureRecovery = "Ask a project admin to publish again.";

/**
 * Every workspace Cal can open, the GitHub accounts each one connects, and the
 * projects inside each one. The team connects both of its accounts; Cal's own
 * workspace publishes with the CLI and connects none.
 */
export const workspaces = [
  {
    id: "mokly",
    name: sample.workspace,
    slug: workspace.slug,
    accounts: githubAccounts.map((account) => account.name),
    administrator: true,
    projects: workspace.projects,
  },
  {
    id: "personal",
    name: members[0].name + "’s projects",
    slug: "cal",
    accounts: [],
    administrator: true,
    projects: [
      {
        id: "notes",
        name: "Release notes",
        slug: "release-notes",
        repository: "calummoore/release-notes",
      },
    ],
  },
] as const;
