import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { repositoryRoot } from "./helpers/fixture.js";
import { findRealRepositoryGitReferences } from "./helpers/test_repository_refs.js";

test("real-repository remote Git calls are identified per call expression", () => {
  const removedHistoryScan = `
    execute("git", ["log", "--format=%s", "origin/main"], {
      cwd: repositoryRoot,
    });
  `;
  const explicitGitRoot = `
    execFileSync("git", ["-C", repositoryRoot, "show", "origin/main:file"]);
  `;
  assert.equal(findRealRepositoryGitReferences(removedHistoryScan).length, 1);
  assert.equal(findRealRepositoryGitReferences(explicitGitRoot).length, 1);
});

test("every documented remote or upstream reference shape is guarded", () => {
  for (const reference of [
    "origin/main",
    "refs/remotes/origin/main",
    "FETCH_HEAD",
    "HEAD@{u}",
    "HEAD@{upstream}",
    "HEAD@{push}",
    "--remotes",
    "branch.main.remote",
    "branch.feature/test.merge",
  ]) {
    const source = `execute("git", ["show", ${JSON.stringify(reference)}], { cwd: repositoryRoot });`;
    const violations = findRealRepositoryGitReferences(source);
    assert.equal(violations.length, 1, reference);
    assert.equal(violations[0]?.reference, reference);
  }
  for (const source of [
    'execute("git", ["show", `origin/${branch}`], { cwd: repositoryRoot });',
    'execute("git", ["config", `branch.${branch}.remote`], { cwd: repositoryRoot });',
  ])
    assert.equal(findRealRepositoryGitReferences(source).length, 1, source);
});

test("fixture Git, local refs and non-Git subprocesses stay allowed", () => {
  const fixtureGit = `
    execute("git", ["log", "origin/main"], { cwd: fixture.root });
  `;
  const localGit = `
    execute("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot });
  `;
  const nodeEval = `
    execute("node", ["-e", "read refs/remotes/origin/main"], {
      cwd: repositoryRoot,
    });
  `;
  assert.deepEqual(findRealRepositoryGitReferences(fixtureGit), []);
  assert.deepEqual(findRealRepositoryGitReferences(localGit), []);
  assert.deepEqual(findRealRepositoryGitReferences(nodeEval), []);
});

test("test sources never read real remote-tracking references", async () => {
  const files = await testSources();
  const violations = (
    await Promise.all(
      files.map(async (file) =>
        findRealRepositoryGitReferences(
          await fs.readFile(file, "utf8"),
          path.relative(repositoryRoot, file),
        ),
      ),
    )
  ).flat();
  assert.deepEqual(
    violations,
    [],
    violations
      .map(
        ({ file, line, column, reference }) =>
          `${file}:${line}:${column} reads ${JSON.stringify(reference)}`,
      )
      .join("\n"),
  );
});

async function testSources(): Promise<string[]> {
  const files: string[] = [];
  for (const root of [
    path.join(repositoryRoot, "tests"),
    path.join(repositoryRoot, "packages/viewer/tests"),
  ])
    await visit(root, files);
  return files.sort();
}

async function visit(directory: string, files: string[]): Promise<void> {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(candidate, files);
    else if (/\.(?:ts|tsx|mts|mjs)$/u.test(entry.name)) files.push(candidate);
  }
}
