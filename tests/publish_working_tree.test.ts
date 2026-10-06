import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { promisify } from "node:util";

import { isCancellation } from "../dist/errors.js";
import type { MoklyWorkingPaths } from "../dist/publish/working_tree.js";
import {
  readUncommittedChanges,
  statusPaths,
  UNCOMMITTED_CHANGES_STATUS,
} from "../dist/publish/working_tree.js";
import { NodeGitCommandRunner } from "../dist/review/git.js";

const execute = promisify(execFile);

async function repository(t: TestContext) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "mokly-working-tree-")),
  );
  t.after(() => fs.rm(root, { force: true, recursive: true }));
  const git = (...args: string[]) =>
    execute("git", ["-c", "protocol.file.allow=always", ...args], {
      cwd: root,
    });
  const write = async (name: string, content = "content\n") => {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), content);
  };
  await git("init", "-q");
  await git("config", "user.email", "test@example.invalid");
  await git("config", "user.name", "Test");
  await write("tracked.txt");
  await write("docs/guide.md");
  await write(".gitignore", "ignored.txt\n");
  await git("add", ".");
  await git("commit", "-qm", "test: clean baseline");
  const working: MoklyWorkingPaths = {
    folders: [
      path.join(root, ".context/mokly-publish"),
      path.join(root, ".context/.mokly-export-reservations"),
      path.join(root, ".mokly-cache"),
      path.join(root, ".context/mokly-review"),
    ],
  };
  const state = (selected = working) =>
    readUncommittedChanges(new NodeGitCommandRunner(root), root, selected);
  return { git, root, state, write };
}

test("a clean checkout and ignored files report no uncommitted changes", async (t) => {
  const repo = await repository(t);
  assert.equal(await repo.state(), false);
  await repo.write("ignored.txt");
  assert.equal(await repo.state(), false);
});

test("tracked, staged, deleted and untracked changes are uncommitted", async (t) => {
  for (const change of ["modified", "staged", "deleted", "untracked"]) {
    const repo = await repository(t);
    if (change === "modified") await repo.write("tracked.txt", "changed\n");
    if (change === "staged") {
      await repo.write("docs/new.md");
      await repo.git("add", "docs/new.md");
    }
    if (change === "deleted") await fs.rm(path.join(repo.root, "tracked.txt"));
    if (change === "untracked") await repo.write("docs/notes/draft.md");
    assert.equal(await repo.state(), true, change);
  }
});

test("untracked files only in Mokly working paths are not uncommitted", async (t) => {
  const repo = await repository(t);
  for (const name of [
    ".context/mokly-publish/index.html",
    ".context/mokly-publish/static/app/view.html",
    ".context/.mokly-export-reservations/.owner",
    ".context/.mokly-export-reservations/locks/mokly-publish/stage/a.html",
    ".mokly-cache/baselines/abc/output/mokly-manifest.json",
    ".context/mokly-review/review.json",
    "specs/.mokly-write-a1b2c3/stage/home.html",
    ".context/.mokly-review-x9/staged.json",
  ])
    await repo.write(name);
  assert.equal(await repo.state(), false);
  await repo.write(".context/other/notes.md");
  assert.equal(await repo.state(), true);
});

test("an aliased output folder is matched by its real repository path", async (t) => {
  const repo = await repository(t);
  await fs.mkdir(path.join(repo.root, "real-context"));
  await fs.symlink(
    path.join(repo.root, "real-context"),
    path.join(repo.root, "linked"),
  );
  await repo.write(".gitignore", "ignored.txt\nlinked\n");
  await repo.git("commit", "-qam", "test: ignore the alias");
  await repo.write("real-context/site/index.html");
  const selected = { folders: [path.join(repo.root, "linked/site")] };
  assert.equal(await repo.state(selected), false);
  await repo.write("real-context/elsewhere.txt");
  assert.equal(await repo.state(selected), true);
});

test("user Git settings cannot hide untracked files or submodule changes", async (t) => {
  const repo = await repository(t);
  await repo.git("config", "status.showUntrackedFiles", "no");
  await repo.write("docs/untracked.md");
  assert.equal(await repo.state(), true);

  const module = await repository(t);
  await fs.rm(path.join(repo.root, "docs/untracked.md"));
  await repo.git("submodule", "add", "-q", module.root, "module");
  await repo.git("commit", "-qm", "test: add a module");
  await repo.git(
    "config",
    "-f",
    ".gitmodules",
    "submodule.module.ignore",
    "all",
  );
  await repo.git("config", "diff.ignoreSubmodules", "all");
  await repo.git("commit", "-qam", "test: ignore the module");
  assert.equal(await repo.state(), false);
  await fs.writeFile(path.join(repo.root, "module/tracked.txt"), "changed\n");
  assert.equal(await repo.state(), true);
  assert.deepEqual(
    [...UNCOMMITTED_CHANGES_STATUS],
    [
      "--no-optional-locks",
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
      "--ignore-submodules=none",
      "--no-renames",
    ],
  );
});

test("derived generated files count only when Mokly cannot prove ownership", async (t) => {
  const repo = await repository(t);
  const owned = new Set([
    path.join(repo.root, "specs/generated/home/index.html"),
    path.join(repo.root, "specs/generated/mokly-manifest.json"),
  ]);
  const selected: MoklyWorkingPaths = {
    folders: [],
    generated: {
      root: path.join(repo.root, "specs/generated"),
      owns: (candidate) => owned.has(candidate),
    },
  };
  for (const name of owned) await repo.write(path.relative(repo.root, name));
  assert.equal(await repo.state(selected), false);
  await repo.write("specs/generated/theme.css");
  assert.equal(await repo.state(selected), true);
});

test("a failed or cancelled status read keeps its classification", async () => {
  const working = { folders: [] };
  await assert.rejects(
    readUncommittedChanges(
      {
        run: async () => {
          throw new Error("index is corrupt");
        },
      },
      "/repo",
      working,
    ),
    /\[mokly\/git-failed\] Git could not report uncommitted changes\. Check the repository, then publish again\./u,
  );
  const abort = new Error("stopped");
  abort.name = "AbortError";
  await assert.rejects(
    readUncommittedChanges(
      {
        run: async () => {
          throw abort;
        },
      },
      "/repo",
      working,
    ),
    (error) => error === abort && isCancellation(error),
  );
});

test("porcelain records yield every named path and reject malformed output", () => {
  assert.deepEqual(statusPaths(""), []);
  assert.deepEqual(
    statusPaths(
      [
        " M tracked.txt",
        "R  renamed name.txt",
        "old name.txt",
        "C  copy.txt",
        "source.txt",
        "UU conflict.txt",
        " T link",
        "?? nested/",
        "!! ignored.txt",
        "?? line\nbreak.txt",
        "",
      ].join("\0"),
    ),
    [
      "tracked.txt",
      "renamed name.txt",
      "old name.txt",
      "copy.txt",
      "source.txt",
      "conflict.txt",
      "link",
      "nested/",
      "line\nbreak.txt",
    ],
  );
  for (const output of [
    " M tracked.txt",
    "XY tracked.txt\0",
    " M\0",
    "R  renamed.txt\0",
    "M tracked.txt\0",
  ])
    assert.throws(() => statusPaths(output), JSON.stringify(output));
});

test("status output that cannot be parsed is a Git failure", async () => {
  await assert.rejects(
    readUncommittedChanges({ run: async () => " M unterminated" }, "/repo", {
      folders: [],
    }),
    /git-failed.*Git could not report uncommitted changes/u,
  );
});
