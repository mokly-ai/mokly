import { pathToFileURL } from "node:url";

/** Conventional Commit types accepted by this repository. */
export const PULL_REQUEST_TITLE_TYPES = Object.freeze([
  "build",
  "chore",
  "ci",
  "docs",
  "feat",
  "fix",
  "perf",
  "refactor",
  "revert",
  "style",
  "test",
]);

const TITLE_LIMIT = 72;

/** Fixed actionable output for an invalid pull request title. */
export const PULL_REQUEST_TITLE_ERROR = `Pull request titles must use type(scope)!: description with type build, chore, ci, docs, feat, fix, perf, refactor, revert, style, or test. Keep any scope lowercase and the whole title to ${TITLE_LIMIT} characters or fewer.`;

const TITLE_PATTERN = new RegExp(
  `^(?:${PULL_REQUEST_TITLE_TYPES.join("|")})(?:\\([a-z0-9._/-]+\\))?!?: \\S(?:[^\\r\\n]*\\S)?$`,
  "u",
);

/** Return whether a complete title satisfies the repository release contract. */
export function isValidPullRequestTitle(title) {
  return (
    typeof title === "string" &&
    [...title].length <= TITLE_LIMIT &&
    TITLE_PATTERN.test(title)
  );
}

function run() {
  if (isValidPullRequestTitle(process.env.PULL_REQUEST_TITLE)) return;
  process.stderr.write(`${PULL_REQUEST_TITLE_ERROR}\n`);
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  run();
