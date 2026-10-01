import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const moduleUrl = pathToFileURL(
  path.resolve("scripts/verification/ratchets/git.mjs"),
).href;
const lengthScript = path.resolve(
  "scripts/verification/source-file-length.mjs",
);

async function fixture(context: { after(cleanup: () => Promise<void>): void }) {
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
  const base = git("rev-parse", "HEAD");
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
  return { root, git, base, mainTip };
}

function inspect(root: string): { base: string; files: { path: string }[] } {
  return JSON.parse(
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
    ),
  );
}

function checkLength(root: string) {
  return spawnSync(process.execPath, [lengthScript], {
    cwd: root,
    encoding: "utf8",
  });
}

test("normal and main-merge ratchets use their respective comparison commits", async (context) => {
  const { root, git, base, mainTip } = await fixture(context);
  assert.equal(inspect(root).base, base);
  assert.equal(checkLength(root).status, 0);
  git("merge", "--no-commit", "--no-ff", "origin/main");
  assert.deepEqual(inspect(root), { base: mainTip, files: [] });
  assert.equal(checkLength(root).status, 0);

  const next = git(
    "commit-tree",
    git("rev-parse", `${mainTip}^{tree}`),
    "-p",
    mainTip,
    "-m",
    "main advanced",
  );
  git("update-ref", "refs/remotes/origin/main", next);
  assert.throws(() => inspect(root), /origin\/main moved during the merge/u);
  const length = checkLength(root);
  assert.equal(length.status, 1);
  assert.match(length.stderr, /origin\/main moved during the merge/u);
});

test("merging another branch keeps the normal merge-base rule", async (context) => {
  const { root, git, base } = await fixture(context);
  git("checkout", "-q", "-b", "other", base);
  await fs.mkdir(path.join(root, "docs/protocol"), { recursive: true });
  await fs.writeFile(path.join(root, "docs/protocol/other.md"), "other\n");
  git("add", ".");
  git("commit", "-qm", "other contract");
  git("checkout", "-q", "feature");
  git("merge", "--no-commit", "--no-ff", "other");
  assert.equal(inspect(root).base, base);
  assert.equal(checkLength(root).status, 0);
});

test("merging a local main ahead of origin/main does not claim main moved", async (context) => {
  const { root, git, base } = await fixture(context);
  git("checkout", "-q", "main");
  await fs.writeFile(path.join(root, "docs/protocol/local.md"), "local\n");
  git("add", ".");
  git("commit", "-qm", "local main contract");
  git("checkout", "-q", "feature");
  git("merge", "--no-commit", "--no-ff", "main");
  const inspected = inspect(root);
  assert.equal(inspected.base, base);
  assert.deepEqual(inspected.files.map(({ path: file }) => file).sort(), [
    "docs/protocol/local.md",
    "docs/protocol/main.md",
  ]);
  assert.equal(checkLength(root).status, 0);
});
