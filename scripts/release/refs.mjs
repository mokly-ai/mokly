import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { runCommand } from "./command.mjs";
import { remoteTagCommit, validateTagVersion } from "./context.mjs";

/** Verify the CLI tag and either a new viewer tag or its earlier pinned tag. */
export async function verifyReleaseRefs(repositoryRoot, cliRef, viewerRef) {
  const viewer = JSON.parse(
    await fs.readFile(`${repositoryRoot}/packages/viewer/package.json`, "utf8"),
  );
  const cli = JSON.parse(
    await fs.readFile(`${repositoryRoot}/packages/mokly/package.json`, "utf8"),
  );
  validateTagVersion(cliRef, cli.version);
  const newViewer = Boolean(viewerRef);
  viewerRef ||= `viewer-v${viewer.version}`;
  validateTagVersion(viewerRef, viewer.version, "viewer-");
  const git = async (...args) =>
    (await runCommand("git", args, { cwd: repositoryRoot })).stdout.trim();
  const head = await git("rev-parse", "HEAD");
  for (const ref of [cliRef, viewerRef]) {
    const local = await git("rev-parse", `${ref}^{commit}`);
    const remote = await git(
      "ls-remote",
      "origin",
      `refs/tags/${ref}`,
      `refs/tags/${ref}^{}`,
    );
    if (
      local !== remoteTagCommit(remote, ref) ||
      ((ref === cliRef || newViewer) && head !== local)
    )
      throw new Error(
        `${ref}, the local checkout, and origin do not identify one commit`,
      );
  }
  if (!newViewer) await git("merge-base", "--is-ancestor", viewerRef, head);
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
