import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const script = path.resolve("scripts/verification/source-file-length.mjs");

test("changed and untracked source/protocol files enforce their separate limits", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-length-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root });
  git("init", "-q");
  git("config", "user.name", "Mokly Test");
  git("config", "user.email", "mokly@example.invalid");
  await fs.mkdir(path.join(root, "src"));
  await fs.mkdir(path.join(root, "docs/protocol"), { recursive: true });
  await fs.writeFile(path.join(root, "src/untouched.ts"), "x\n".repeat(310));
  await fs.writeFile(path.join(root, "src/changed.ts"), "x\n");
  git("add", ".");
  git("commit", "-qm", "baseline");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  await fs.writeFile(path.join(root, "src/changed.ts"), "x\n".repeat(301));
  await fs.writeFile(
    path.join(root, "docs/protocol/new.md"),
    "x\n".repeat(251),
  );
  const check = (args: string[]) =>
    spawnSync(process.execPath, [script, ...args], {
      cwd: root,
      encoding: "utf8",
    });
  const changed = check([]);
  assert.notEqual(changed.status, 0);
  assert.match(changed.stderr, /src\/changed.ts: 301 lines \(limit 300\)/);
  assert.match(
    changed.stderr,
    /docs\/protocol\/new.md: 251 lines \(limit 250\)/,
  );
  assert.doesNotMatch(changed.stderr, /untouched.ts/);
  const audit = check(["--all"]);
  assert.equal(audit.status, 1);
  assert.match(audit.stderr, /src\/untouched.ts: 310 lines \(limit 300\)/);
});

test("clean committed branch changes are audited against origin/main", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-length-branch-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root });
  git("init", "-q");
  git("config", "user.name", "Mokly Test");
  git("config", "user.email", "mokly@example.invalid");
  await fs.mkdir(path.join(root, "docs/protocol"), { recursive: true });
  await fs.writeFile(path.join(root, "README.md"), "baseline\n");
  git("add", ".");
  git("commit", "-qm", "baseline");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  await fs.mkdir(path.join(root, "examples"));
  await fs.writeFile(
    path.join(root, "examples/oversize.mts"),
    "x\n".repeat(301),
  );
  await fs.writeFile(
    path.join(root, "docs/protocol/oversize.md"),
    "x\n".repeat(251),
  );
  git("add", ".");
  git("commit", "-qm", "oversized branch files");
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /examples\/oversize\.mts: 301 lines/);
  assert.match(result.stderr, /docs\/protocol\/oversize\.md: 251 lines/);
});

test("staged-only, exact-limit and subdirectory invocation use the repository root", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-length-stage-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root });
  git("init", "-q");
  git("config", "user.name", "Mokly Test");
  git("config", "user.email", "mokly@example.invalid");
  await fs.mkdir(path.join(root, "packages/viewer/tests"), { recursive: true });
  await fs.mkdir(path.join(root, "packages/viewer/scripts"), {
    recursive: true,
  });
  await fs.writeFile(path.join(root, "README.md"), "baseline\n");
  git("add", ".");
  git("commit", "-qm", "baseline");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  await fs.writeFile(
    path.join(root, "packages/viewer/tests/exact.cts"),
    "x\n".repeat(300),
  );
  await fs.writeFile(
    path.join(root, "packages/viewer/scripts/long.jsx"),
    "x\n".repeat(301),
  );
  await fs.mkdir(path.join(root, "examples"));
  const newScopeCases = [
    "examples/long.cts",
    "packages/viewer/tests/long.ts",
    "packages/viewer/tests/long.tsx",
    "packages/viewer/tests/long.js",
    "packages/viewer/tests/long.mjs",
    "packages/viewer/tests/long.cjs",
  ];
  for (const file of newScopeCases)
    await fs.writeFile(path.join(root, file), "x\n".repeat(301));
  git("add", ".");
  const check = (...args: string[]) =>
    spawnSync(process.execPath, [script, ...args], {
      cwd: path.join(root, "packages/viewer"),
      encoding: "utf8",
    });
  const changed = check();
  assert.equal(changed.status, 1);
  assert.match(
    changed.stderr,
    /packages\/viewer\/scripts\/long\.jsx: 301 lines/,
  );
  for (const file of newScopeCases)
    await context.test(`${file} is in scope`, () =>
      assert.ok(changed.stderr.includes(`${file}: 301 lines`)),
    );
  assert.doesNotMatch(changed.stderr, /exact\.cts/);
  const all = check("--all");
  assert.equal(all.status, 1);
  assert.match(all.stderr, /packages\/viewer\/scripts\/long\.jsx/);
});
