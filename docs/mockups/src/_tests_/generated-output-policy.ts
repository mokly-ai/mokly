/** Git owns sources; Mokly output must never enter the repository index. */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

import { GENERATED_DIRECTORY } from "@mokly/viewer/data";

import { outputDirectory } from "./generated-output-fixture";

/**
 * The directory beside each build output where Mokly reserves it against
 * competing writers, as the installed `mokly-export-safety.md` names it.
 */
export const reservationDirectory = ".mokly-export-reservations";

/**
 * Whether a repository path lies below the build output at the root, below a
 * reservation directory, or below a `mokly-generated` directory at any depth,
 * which earlier releases wrote.
 */
function isMoklyOutput(file: string): boolean {
  const directories = file.split("/").slice(0, -1);
  return (
    directories[0] === outputDirectory ||
    directories.some(
      (name) => name === reservationDirectory || name === GENERATED_DIRECTORY,
    )
  );
}

export function assertNoTrackedGeneratedOutput(root: string) {
  const paths = execFileSync(
    "git",
    ["ls-files", "--cached", "--full-name", "-z"],
    {
      cwd: root,
      encoding: "utf8",
    },
  )
    .split("\0")
    .filter(isMoklyOutput)
    .sort();
  assert.equal(
    paths.length,
    0,
    "Git tracks generated mockup output:\n" + paths.join("\n"),
  );
}
