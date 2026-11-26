/**
 * Published tags are immutable, and versions advance only through the
 * release pull request. So no released package of the repository has a
 * version below its newest release tag that `HEAD` reaches. A release pull
 * request already holds the next version, which has no tag yet.
 */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { lte, rcompare, valid } from "semver";

import { repositoryRoot } from "./helpers/fixture.js";
import { git } from "./helpers/public_export_ratchet.js";

/** The newest release tag with `prefix` in the history of `HEAD`. */
function newestReleaseTag(prefix: string): string {
  const tags = git(
    repositoryRoot,
    "tag",
    "--list",
    `${prefix}[0-9]*`,
    "--merged",
    "HEAD",
  )
    .split("\n")
    .filter((tag) => valid(tag.slice(prefix.length)) !== null)
    .sort((left, right) =>
      rcompare(left.slice(prefix.length), right.slice(prefix.length)),
    );
  assert.ok(tags[0], `no reachable ${prefix} tag; run git fetch --tags origin`);
  return tags[0];
}

test("released package versions never fall below their newest release tag", async () => {
  for (const [directory, prefix] of [
    ["packages/mokly", "v"],
    ["packages/ui", "v"],
    ["packages/viewer", "viewer-v"],
  ] as const) {
    const { version } = JSON.parse(
      await fs.readFile(
        path.join(repositoryRoot, directory, "package.json"),
        "utf8",
      ),
    );
    const tag = newestReleaseTag(prefix);
    assert.ok(lte(tag.slice(prefix.length), version), `${tag} > ${version}`);
  }
});
