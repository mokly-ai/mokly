import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { cliPackageRoot } from "../../scripts/package/layout.mjs";

const execute = promisify(execFile);

/** Create a clean tagged workspace with the current CLI package location. */
export async function releaseRefsFixture(t: {
  after(fn: () => Promise<void>): void;
}) {
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-release-refs-"),
  );
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const root = path.join(temporary, "repository");
  const cliRoot = cliPackageRoot(root);
  const viewerRoot = path.join(root, "packages/viewer");
  await fs.mkdir(cliRoot, { recursive: true });
  await fs.mkdir(viewerRoot, { recursive: true });
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "release-refs-workspace",
      private: true,
      workspaces: ["packages/viewer", "packages/mokly"],
    }),
  );
  await fs.writeFile(
    path.join(cliRoot, "package.json"),
    JSON.stringify({
      name: "@mokly/mokly",
      version: "0.8.0",
      dependencies: { "@mokly/viewer": "0.1.0" },
    }),
  );
  await fs.writeFile(
    path.join(viewerRoot, "package.json"),
    JSON.stringify({ name: "@mokly/viewer", version: "0.1.0" }),
  );
  const git = async (...args: string[]) =>
    (await execute("git", args, { cwd: root })).stdout.trim();
  await git("init", "--initial-branch=main");
  await git("config", "user.email", "release-refs@example.invalid");
  await git("config", "user.name", "Release Refs Test");
  await git("add", "-A");
  await git(
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "-m",
    "test: current workspace release",
  );
  const expectedCommit = await git("rev-parse", "HEAD");
  return { root, expectedCommit, git };
}
