import type { FixtureBuild } from "./builds";

/**
 * What a failed or timed-out build's card says about its cause, keyed as the
 * cause table of the viewer builds contract names each row, each with that
 * row's sentence. These are the reader's half of a failure; commands and exit
 * codes stay in the output.
 */
export const causeSentences = {
  "exit at install": "Installing dependencies failed.",
  "exit at publish": "The catalogue couldn’t be built.",
  "upload-rejected": "Mokly couldn’t accept this catalogue.",
  "unsupported-lockfile": "Mokly installs with npm, pnpm or Yarn.",
  "unsupported-mokly-version":
    "Update `@mokly/mokly` to 0.18.0 or later to publish.",
  "uncommitted-changes":
    "The build left files that Git doesn’t ignore; add them to .gitignore.",
  "output-limit": "The build printed too much output; print less to publish.",
  deadline: "The build stopped at its 15-minute limit.",
  idle: "The build stopped after going quiet.",
  infrastructure: "Mokly couldn’t run this build.",
  "repository-unavailable":
    "Mokly can’t reach this repository; check the GitHub installation.",
} as const;

/**
 * The operation a screen reader hears while a card's control waits for its
 * request: a build request names the reference it publishes, and Cancel
 * names the build it stops.
 */
export const requestOperations = {
  branch: "Publishing this branch",
  "pull-request": "Publishing this pull request",
  cancel: "Cancelling this build",
} as const;

/** The sentence a failed or timed-out build's card says, or none. */
export function causeSentence(build: FixtureBuild): string | undefined {
  if (build.cause === undefined || build.cause === "plan-required")
    return undefined;
  if (build.cause === "exit")
    return causeSentences[
      build.step === "install" ? "exit at install" : "exit at publish"
    ];
  return causeSentences[build.cause];
}

/** The line the output draws where retained bytes were dropped. */
export function elisionText(bytes: number): string {
  const size =
    bytes >= 1_000_000
      ? (bytes / 1_000_000).toFixed(1) + " MB"
      : (bytes / 1_000).toFixed(1) + " KB";
  return size + " of output not kept";
}
