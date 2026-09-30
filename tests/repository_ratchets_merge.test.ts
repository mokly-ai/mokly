import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const moduleUrl = pathToFileURL(
  path.resolve("scripts/verification/ratchets/git.mjs"),
).href;

test("an uncommitted merge ratchets against the main tip being merged", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-ratchet-merge-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Mokly Test");
  git("config", "user.email", "mokly@example.invalid");
  await fs.writeFile(path.join(root, "README.md"), "baseline\n");
  git("add", ".");
  git("commit", "-qm", "baseline");
  git("branch", "feature");
  await fs.mkdir(path.join(root, "docs/protocol"), { recursive: true });
  await fs.writeFile(path.join(root, "docs/protocol/main.md"), "main\n");
  git("add", ".");
  git("commit", "-qm", "main contract");
  const mainTip = git("rev-parse", "HEAD");
  git("update-ref", "refs/remotes/origin/main", mainTip);
  git("checkout", "-q", "feature");
  await fs.writeFile(path.join(root, "README.md"), "feature\n");
  git("add", ".");
  git("commit", "-qm", "feature change");
  git("merge", "--no-commit", "--no-ff", "origin/main");

  const inspect = () =>
    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { GitWorkspace } from ${JSON.stringify(moduleUrl)};
const git = new GitWorkspace(process.argv[1]);
console.log(JSON.stringify({ base: git.requireBase(), files: git.changedFiles(["docs/protocol"]) }));`,
        root,
      ],
      { cwd: root, encoding: "utf8" },
    );
  assert.deepEqual(JSON.parse(inspect()), { base: mainTip, files: [] });
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  assert.throws(inspect, /origin\/main moved during the merge/);
});
