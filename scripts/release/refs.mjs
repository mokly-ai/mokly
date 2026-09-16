import assert from "node:assert/strict";

import { runCommand } from "../package/command.mjs";
import {
  readPackageManifest,
  validateVersionPair,
} from "../package/manifest.mjs";

import { remoteTagCommit, validateTagVersion } from "./context.mjs";

/** Both protected tag streams must identify the same clean release tree. */
export async function verifyReleaseRefs(repositoryRoot, cliRef, viewerRef) {
  const cli = await readPackageManifest(repositoryRoot);
  const viewer = await readPackageManifest(`${repositoryRoot}/packages/viewer`);
  validateVersionPair(cli, viewer);
  validateTagVersion(cliRef, cli.version);
  validateTagVersion(viewerRef, viewer.version, "viewer-");
  const git = async (...args) =>
    (await runCommand("git", args, { cwd: repositoryRoot })).stdout.trim();
  const head = await git("rev-parse", "HEAD");
  for (const ref of [viewerRef, cliRef]) {
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
