import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { runCommand } from "./command.mjs";
import { remoteTagCommit, validateTagVersion } from "./context.mjs";

/** The protected viewer tag identifies the clean release tree. */
export async function verifyReleaseRefs(repositoryRoot, viewerRef) {
  const viewer = JSON.parse(
    await fs.readFile(`${repositoryRoot}/packages/viewer/package.json`, "utf8"),
  );
  validateTagVersion(viewerRef, viewer.version, "viewer-");
  const git = async (...args) =>
    (await runCommand("git", args, { cwd: repositoryRoot })).stdout.trim();
  const head = await git("rev-parse", "HEAD");
  for (const ref of [viewerRef]) {
    const local = await git("rev-parse", `${ref}^{commit}`);
    const remote = await git(
      "ls-remote",
      "origin",
      `refs/tags/${ref}`,
      `refs/tags/${ref}^{}`,
    );
    if (head !== local || head !== remoteTagCommit(remote, ref))
      throw new Error(
        `${ref}, the local checkout, and origin do not identify one commit`,
      );
  }
  assert.equal(
    await git(
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
      "--ignore-submodules=none",
    ),
    "",
    "release requires a clean source tree",
  );
  return head;
}
