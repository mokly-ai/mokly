/** Conventional Commit types accepted by this repository. */
export const PULL_REQUEST_TITLE_TYPES: readonly string[];

/** Fixed actionable output for an invalid pull request title. */
export const PULL_REQUEST_TITLE_ERROR: string;

/** Return whether a complete title satisfies the repository release contract. */
export function isValidPullRequestTitle(title: unknown): boolean;
